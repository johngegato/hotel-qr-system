// backend/audio-signaling/server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

// Health check endpoint (for Railway/monitoring)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeCalls: activeCalls.size,
    queueLength: callQueue.length
  });
});

const server = http.createServer(app);

// Configure CORS - allow all origins in development, restrict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : true; // Use `true` for wildcard in Socket.io

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ============================================
// STATE MANAGEMENT (Extensible for future features)
// ============================================

// Active calls: Map<callId, CallData>
const activeCalls = new Map();

// Call queue: Array<{callId, roomNumber, guestSocketId, joinedAt}>
const callQueue = [];

// Call logs: Will be persisted to database later
const callLogs = [];

// Configuration: Will be loaded from database later
const config = {
  maxCallDuration: 120, // seconds
  maxQueueSize: 5,
  cooldownPeriod: 300 // seconds
};

// ============================================
// HELPER FUNCTIONS (Extensible)
// ============================================

function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getQueuePosition(callId) {
  return callQueue.findIndex(item => item.callId === callId) + 1;
}

function broadcastQueueUpdate() {
  // Notify all queued guests of their position
  callQueue.forEach((item, index) => {
    io.to(item.guestSocketId).emit('queue_update', {
      position: index + 1,
      estimatedWait: (index + 1) * 60 // Simple estimate: 1 min per person
    });
  });
}

// ============================================
// SOCKET.IO CONNECTION HANDLER
// ============================================

io.on("connection", (socket) => {
  console.log(`[Audio] Client connected: ${socket.id}`);

  // Front desk joins reception room
  socket.on("join_reception", () => {
    socket.join("reception");
    console.log(`[Audio] Front desk joined reception: ${socket.id}`);
    
    // Send current queue state
    socket.emit('queue_state', {
      queueLength: callQueue.length,
      activeCall: activeCalls.size > 0
    });
  });

  // Guest initiates call
  socket.on("initiate_call", (data) => {
    const { roomNumber, offer } = data;
    
    // Check if front desk is available
    const isFrontDeskBusy = activeCalls.size > 0;
    const isQueueFull = callQueue.length >= config.maxQueueSize;
    
    if (isQueueFull) {
      socket.emit('call_rejected', { 
        reason: 'queue_full',
        message: 'Queue is full. Please try again later.'
      });
      return;
    }
    
    const callId = generateCallId();
    
    const callData = {
      callId,
      roomNumber,
      guestSocketId: socket.id,
      frontDeskSocketId: null,
      status: isFrontDeskBusy ? 'queued' : 'ringing',
      offer,
      startedAt: new Date(),
      connectedAt: null,
      endedAt: null,
      duration: 0
    };
    
    activeCalls.set(callId, callData);
    
    if (isFrontDeskBusy) {
      // Add to queue
      callQueue.push({
        callId,
        roomNumber,
        guestSocketId: socket.id,
        joinedAt: new Date()
      });
      
      socket.emit('call_queued', {
        callId,
        position: callQueue.length,
        estimatedWait: callQueue.length * 60
      });
      
      // Notify front desk of queue update
      io.to("reception").emit('queue_updated', {
        queueLength: callQueue.length,
        queue: callQueue.map(item => ({
          callId: item.callId,
          roomNumber: item.roomNumber,
          waitTime: Math.floor((new Date() - item.joinedAt) / 1000)
        }))
      });
    } else {
      // Direct to front desk
      io.to("reception").emit("incoming_call", {
        callId,
        roomNumber,
        guestSocketId: socket.id,
        offer
      });
    }
    
    socket.emit('call_initiated', { callId });
    
    console.log(`[Audio] Call initiated: ${callId} from room ${roomNumber}`);
  });

  // Front desk answers call
  socket.on("answer_call", (data) => {
    const { callId, answer } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      call.frontDeskSocketId = socket.id;
      call.status = 'connected';
      call.connectedAt = new Date();
      
      // Remove from queue if it was queued
      const queueIndex = callQueue.findIndex(item => item.callId === callId);
      if (queueIndex !== -1) {
        callQueue.splice(queueIndex, 1);
        broadcastQueueUpdate();
      }
      
      // Send answer to guest
      io.to(call.guestSocketId).emit("call_answered", { answer });
      
      // Start duration timer
      setTimeout(() => {
        const currentCall = activeCalls.get(callId);
        if (currentCall && currentCall.status === 'connected') {
          io.to(currentCall.guestSocketId).emit('call_duration_warning', { secondsLeft: 10 });
        }
      }, (config.maxCallDuration - 10) * 1000);
      
      setTimeout(() => {
        const currentCall = activeCalls.get(callId);
        if (currentCall && currentCall.status === 'connected') {
          io.to(currentCall.guestSocketId).emit('call_ended', { reason: 'duration_limit' });
          io.to(currentCall.frontDeskSocketId).emit('call_ended', { reason: 'duration_limit' });
          activeCalls.delete(callId);
          
          // Log the call
          callLogs.push({
            callId,
            roomNumber: currentCall.roomNumber,
            startedAt: currentCall.startedAt,
            connectedAt: currentCall.connectedAt,
            endedAt: new Date(),
            duration: config.maxCallDuration,
            status: 'completed',
            endedBy: 'system'
          });
          
          // Check queue for next call
          if (callQueue.length > 0) {
            const nextCall = callQueue[0];
            const nextCallData = activeCalls.get(nextCall.callId);
            if (nextCallData) {
              io.to("reception").emit("incoming_call", {
                callId: nextCall.callId,
                roomNumber: nextCall.roomNumber,
                guestSocketId: nextCall.guestSocketId,
                offer: nextCallData.offer
              });
            }
          }
        }
      }, config.maxCallDuration * 1000);
      
      console.log(`[Audio] Call answered: ${callId}`);
    }
  });

  // Exchange ICE candidates
  socket.on("ice_candidate", (data) => {
    const { callId, candidate } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      const targetSocketId = socket.id === call.guestSocketId 
        ? call.frontDeskSocketId 
        : call.guestSocketId;
      
      if (targetSocketId) {
        io.to(targetSocketId).emit("ice_candidate", { candidate });
      }
    }
  });

  // End call (either party)
  socket.on("end_call", (data) => {
    const { callId, endedBy = 'user' } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      const targetSocketId = socket.id === call.guestSocketId 
        ? call.frontDeskSocketId 
        : call.guestSocketId;
      
      if (targetSocketId) {
        io.to(targetSocketId).emit("call_ended", { reason: endedBy });
      }
      
      // Log the call
      callLogs.push({
        callId,
        roomNumber: call.roomNumber,
        startedAt: call.startedAt,
        connectedAt: call.connectedAt,
        endedAt: new Date(),
        duration: call.connectedAt 
          ? Math.floor((new Date() - call.connectedAt) / 1000)
          : 0,
        status: call.connectedAt ? 'completed' : 'rejected',
        endedBy
      });
      
      // Remove from queue if queued
      const queueIndex = callQueue.findIndex(item => item.callId === callId);
      if (queueIndex !== -1) {
        callQueue.splice(queueIndex, 1);
        broadcastQueueUpdate();
      }
      
      activeCalls.delete(callId);
      
      // Check queue for next call
      if (callQueue.length > 0 && call.status === 'connected') {
        const nextCall = callQueue[0];
        const nextCallData = activeCalls.get(nextCall.callId);
        if (nextCallData) {
          io.to("reception").emit("incoming_call", {
            callId: nextCall.callId,
            roomNumber: nextCall.roomNumber,
            guestSocketId: nextCall.guestSocketId,
            offer: nextCallData.offer
          });
        }
      }
      
      console.log(`[Audio] Call ended: ${callId}`);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`[Audio] Client disconnected: ${socket.id}`);
    
    // Clean up any active calls for this socket
    for (const [callId, call] of activeCalls.entries()) {
      if (call.guestSocketId === socket.id || call.frontDeskSocketId === socket.id) {
        const targetSocketId = socket.id === call.guestSocketId 
          ? call.frontDeskSocketId 
          : call.guestSocketId;
        
        if (targetSocketId) {
          io.to(targetSocketId).emit("call_ended", { reason: 'disconnected' });
        }
        
        // Log the call
        callLogs.push({
          callId,
          roomNumber: call.roomNumber,
          startedAt: call.startedAt,
          connectedAt: call.connectedAt,
          endedAt: new Date(),
          duration: call.connectedAt 
            ? Math.floor((new Date() - call.connectedAt) / 1000)
            : 0,
          status: 'dropped',
          endedBy: 'system'
        });
        
        // Remove from queue
        const queueIndex = callQueue.findIndex(item => item.callId === callId);
        if (queueIndex !== -1) {
          callQueue.splice(queueIndex, 1);
          broadcastQueueUpdate();
        }
        
        activeCalls.delete(callId);
      }
    }
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Audio Signaling Server running on ${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

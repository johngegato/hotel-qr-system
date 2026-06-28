import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert
} from 'react-native';
import { io } from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  registerGlobals
} from 'react-native-webrtc';

// Register WebRTC globals
registerGlobals();

// Configuration
// Change this to your Railway deployment URL after deploying
const SERVER_URL = 'https://artistic-possibility-production.up.railway.app';

export default function App() {
  // State
  const [callState, setCallState] = useState('idle'); // idle, ringing, connected
  const [currentCall, setCurrentCall] = useState(null);
  const [queue, setQueue] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  
  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const pendingOfferRef = useRef(null);
  
  // Initialize Socket.io
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Connected to signaling server');
      socket.emit('join_reception');
    });
    
    socket.on('incoming_call', (data) => {
      console.log('Incoming call:', data);
      setCurrentCall(data);
      pendingOfferRef.current = data.offer;
      setCallState('ringing');
    });
    
    socket.on('queue_updated', (data) => {
      console.log('Queue updated:', data);
      setQueue(data.queue);
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);
  
  // Answer call
  const answerCall = async () => {
    try {
      // Get microphone
      const stream = await mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      localStreamRef.current = stream;
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;
      
      // Add local audio tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Handle remote audio
      pc.ontrack = (event) => {
        console.log('Received remote audio track');
        // React Native WebRTC handles playback automatically
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('ice_candidate', {
            callId: currentCall.callId,
            candidate: event.candidate
          });
        }
      };
      
      // Set remote description (offer from guest)
      await pc.setRemoteDescription(
        new RTCSessionDescription(pendingOfferRef.current)
      );
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer to server
      socketRef.current.emit('answer_call', {
        callId: currentCall.callId,
        answer: pc.localDescription
      });
      
      setCallState('connected');
      startTimer();
      
    } catch (error) {
      console.error('Error answering call:', error);
      Alert.alert('Error', 'Failed to answer call');
      setCallState('idle');
    }
  };
  
  // Decline call
  const declineCall = () => {
    socketRef.current.emit('end_call', {
      callId: currentCall.callId,
      endedBy: 'front_desk'
    });
    cleanup();
    setCallState('idle');
    setCurrentCall(null);
  };
  
  // End call
  const endCall = () => {
    socketRef.current.emit('end_call', {
      callId: currentCall.callId,
      endedBy: 'front_desk'
    });
    cleanup();
    setCallState('idle');
    setCurrentCall(null);
  };
  
  // Cleanup
  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    stopTimer();
  };
  
  // Timer functions
  const startTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };
  
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  // Render queue item
  const renderQueueItem = ({ item }) => (
    <View style={styles.queueItem}>
      <Text style={styles.queueRoom}>Room {item.roomNumber}</Text>
      <Text style={styles.queueWait}>Waiting: {formatTime(item.waitTime)}</Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Front Desk</Text>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: callState === 'idle' ? '#48bb78' : '#f56565' }
          ]} />
          <Text style={styles.statusText}>
            {callState === 'idle' ? 'Available' : 'On Call'}
          </Text>
        </View>
      </View>
      
      <View style={styles.content}>
        {callState === 'idle' && (
          <View style={styles.idleContainer}>
            <Text style={styles.idleIcon}>🏨</Text>
            <Text style={styles.idleText}>Waiting for calls...</Text>
            
            {queue.length > 0 && (
              <View style={styles.queueContainer}>
                <Text style={styles.queueTitle}>Queue ({queue.length})</Text>
                <FlatList
                  data={queue}
                  renderItem={renderQueueItem}
                  keyExtractor={item => item.callId}
                />
              </View>
            )}
          </View>
        )}
        
        {callState === 'ringing' && currentCall && (
          <View style={styles.ringingContainer}>
            <View style={styles.ringingPulse}>
              <Text style={styles.ringingIcon}>📞</Text>
            </View>
            <Text style={styles.ringingRoom}>Room {currentCall.roomNumber}</Text>
            <Text style={styles.ringingText}>Incoming Call</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={declineCall}
              >
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.answerButton]}
                onPress={answerCall}
              >
                <Text style={styles.buttonText}>Answer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {callState === 'connected' && currentCall && (
          <View style={styles.connectedContainer}>
            <View style={styles.connectedPulse}>
              <Text style={styles.connectedIcon}>🎙️</Text>
            </View>
            <Text style={styles.connectedRoom}>Room {currentCall.roomNumber}</Text>
            <Text style={styles.connectedTimer}>{formatTime(callDuration)}</Text>
            
            <TouchableOpacity
              style={[styles.button, styles.endButton]}
              onPress={endCall}
            >
              <Text style={styles.buttonText}>End Call</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a202c'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2d3748',
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568'
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8
  },
  statusText: {
    color: 'white',
    fontSize: 16
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  idleContainer: {
    alignItems: 'center',
    width: '100%'
  },
  idleIcon: {
    fontSize: 64,
    marginBottom: 20
  },
  idleText: {
    color: 'white',
    fontSize: 20,
    marginBottom: 30
  },
  queueContainer: {
    width: '100%',
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 15
  },
  queueTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  queueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#4a5568',
    borderRadius: 5,
    marginBottom: 5
  },
  queueRoom: {
    color: 'white',
    fontSize: 16
  },
  queueWait: {
    color: '#a0aec0',
    fontSize: 14
  },
  ringingContainer: {
    alignItems: 'center'
  },
  ringingPulse: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4299e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  ringingIcon: {
    fontSize: 48
  },
  ringingRoom: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10
  },
  ringingText: {
    color: '#a0aec0',
    fontSize: 18,
    marginBottom: 40
  },
  connectedContainer: {
    alignItems: 'center'
  },
  connectedPulse: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#48bb78',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  connectedIcon: {
    fontSize: 48
  },
  connectedRoom: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10
  },
  connectedTimer: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 40
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 20
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 120,
    alignItems: 'center'
  },
  declineButton: {
    backgroundColor: '#f56565'
  },
  answerButton: {
    backgroundColor: '#48bb78'
  },
  endButton: {
    backgroundColor: '#f56565',
    paddingHorizontal: 60
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600'
  }
});
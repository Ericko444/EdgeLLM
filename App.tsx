import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';

import { useLlama } from './src/hooks/useLlama';
import ModelSelectionScreen from './src/components/ModelSelectionScreen';
import ChatScreen from './src/components/ChatScreen';
import { INITIAL_CONVERSATION } from './src/constants';

type CurrentPage = 'modelSelection' | 'conversation';

function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<CurrentPage>('modelSelection');
  const [currentModelName, setCurrentModelName] = useState<string | null>(null);

  const {
    context: llamaContext,
    isModelLoading,
    isGenerating,
    conversation,
    loadLlamaModel,
    releaseLlamaModel,
    generateChatCompletion,
    setConversation, // From useLlama
  } = useLlama();

  const handleModelDownloaded = useCallback(async (modelFileName: string) => {
    console.log(`Model ${modelFileName} downloaded, attempting to load.`);
    setCurrentModelName(modelFileName);
    const loadedContext = await loadLlamaModel(modelFileName);
    if (loadedContext) {
      setCurrentPage('conversation');
    } else {
      Alert.alert("Model Load Failed", "Could not load the model. Please try another or re-download.");
      setCurrentModelName(null); // Reset if load failed
      setCurrentPage('modelSelection'); // Ensure user can select again
    }
  }, [loadLlamaModel]);

  const handleSendMessage = useCallback(async (message: string) => {
    await generateChatCompletion(message);
  }, [generateChatCompletion]);

  const navigateToModelSelection = useCallback(async () => {
    // Optionally release model when going back
    // await releaseLlamaModel();
    // setCurrentModelName(null);
    // setConversation(INITIAL_CONVERSATION); // Reset conversation state
    setCurrentPage('modelSelection');
  }, []);


  // Effect to release model on app close (though this is hard to guarantee in RN)
  useEffect(() => {
    return () => {
      console.log("App unmounting, releasing Llama model if any.");
      releaseLlamaModel();
    };
  }, [releaseLlamaModel]);


  const renderContent = () => {
    if (isModelLoading) {
      return (
        <View style={styles.centeredMessage}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading model: {currentModelName || ''}...</Text>
        </View>
      );
    }

    switch (currentPage) {
      case 'modelSelection':
        return (
          <ScrollView contentContainerStyle={styles.scrollView}>
            <Text style={styles.title}>LLM Chat</Text>
            <ModelSelectionScreen
              onModelDownloaded={handleModelDownloaded}
              styles={styles}
            />
          </ScrollView>
        );
      case 'conversation':
        return (
          <ChatScreen
            llamaContext={llamaContext}
            conversation={conversation}
            isGenerating={isGenerating}
            onSendMessage={handleSendMessage}
            onGoBack={navigateToModelSelection}
            styles={styles}
            modelName={currentModelName || undefined}
          />
        );
      default:
        return <Text>Unknown page</Text>;
    }
  };

  return <SafeAreaView style={styles.container}>{renderContent()}</SafeAreaView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    padding: 16,
    flexGrow: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    marginVertical: 24,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 16,
    marginTop: 16,
  },
  subtitle2: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
    color: '#93C5FD',
  },
  button: {
    backgroundColor: '#93C5FD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 6,
    shadowColor: '#93C5FD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedButton: {
    backgroundColor: '#2563EB',
  },
  buttonTextGGUF: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatContainerScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  chatContentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  modelNameText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
    textAlign: 'center'
  },
  messageWrapper: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    marginLeft: 'auto',
  },
  llamaBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 'auto',
  },
  messageText: {
    fontSize: 16,
    color: '#334155',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  greetingText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 12,
    color: '#64748B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#334155',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  disabledButton: {
    backgroundColor: '#A5B4FC',
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#334155',
  },
});

export default App;
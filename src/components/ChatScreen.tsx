import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Message } from '../types';
import { LlamaContext } from 'llama.rn';

interface ChatScreenProps {
    llamaContext: LlamaContext | null;
    conversation: Message[];
    isGenerating: boolean;
    onSendMessage: (message: string) => Promise<void>;
    onGoBack: () => void; // To go back to model selection
    styles: any;
    modelName?: string;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
    llamaContext,
    conversation,
    isGenerating,
    onSendMessage,
    onGoBack,
    styles,
    modelName,
}) => {
    const [userInput, setUserInput] = useState<string>('');
    const scrollViewRef = useRef<ScrollView>(null);

    const handleSend = async () => {
        if (!userInput.trim()) return;
        await onSendMessage(userInput);
        setUserInput('');
    };

    useEffect(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    }, [conversation]);

    if (!llamaContext) {
        return (
            <View style={styles.chatContainer}>
                <Text style={styles.greetingText}>Model is not loaded. Please select a model.</Text>
                <TouchableOpacity style={styles.sendButton} onPress={onGoBack}>
                    <Text style={styles.buttonText}>Select Model</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
            <View style={{ flex: 1 }}>
                <View style={styles.chatHeader}>
                    <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
                        <Text style={styles.backButtonText}>‹ Models</Text>
                    </TouchableOpacity>
                    {modelName && <Text style={styles.modelNameText}>Chatting with: {modelName.split('.')[0]}</Text>}
                </View>
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.chatContentContainer}
                    style={styles.chatContainerScroll}
                >
                    <Text style={styles.greetingText}>
                        🦙 Llama is ready! Ask anything.
                    </Text>
                    {conversation.slice(1).map((msg, index) => ( // Slice 1 to skip system message
                        <View key={index} style={styles.messageWrapper}>
                            <View
                                style={[
                                    styles.messageBubble,
                                    msg.role === 'user'
                                        ? styles.userBubble
                                        : styles.llamaBubble,
                                ]}>
                                <Text
                                    style={[
                                        styles.messageText,
                                        msg.role === 'user' && styles.userMessageText,
                                    ]}>
                                    {msg.content}
                                </Text>
                            </View>
                        </View>
                    ))}
                    {isGenerating && (
                        <View style={styles.messageWrapper}>
                            <View style={[styles.messageBubble, styles.llamaBubble]}>
                                <ActivityIndicator size="small" color="#334155" />
                            </View>
                        </View>
                    )}
                </ScrollView>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type your message..."
                        placeholderTextColor="#94A3B8"
                        value={userInput}
                        onChangeText={setUserInput}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, isGenerating && styles.disabledButton]}
                        onPress={handleSend}
                        disabled={isGenerating || !userInput.trim()}>
                        <Text style={styles.buttonText}>
                            {isGenerating ? '...' : 'Send'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default ChatScreen;
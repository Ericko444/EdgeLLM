// src/hooks/useLlama.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { initLlama, releaseAllLlama, LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import { Message } from '../types';
import { CHAT_STOP_WORDS, INITIAL_CONVERSATION } from '../constants';

export const useLlama = () => {
    const [context, setContext] = useState<LlamaContext | null>(null);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [conversation, setConversation] = useState<Message[]>(INITIAL_CONVERSATION);

    const loadLlamaModel = useCallback(async (modelName: string) => {
        setIsModelLoading(true);
        try {
            const modelPath = `${RNFS.DocumentDirectoryPath}/${modelName}`;
            const fileExists = await RNFS.exists(modelPath);
            if (!fileExists) {
                Alert.alert('Error Loading Model', `The model file ${modelName} does not exist at ${modelPath}.`);
                setIsModelLoading(false);
                return null;
            }

            if (context) {
                await releaseAllLlama();
                setContext(null);
                setConversation(INITIAL_CONVERSATION); // Reset conversation when model changes
            }

            const llamaContext = await initLlama({
                model: modelPath,
                use_mlock: true,
                n_ctx: 2048,
                n_gpu_layers: 1, // Adjust based on device capabilities
            });
            console.log("LlamaContext initialized:", llamaContext?.id);
            setContext(llamaContext);
            setConversation(INITIAL_CONVERSATION); // Ensure fresh conversation for new model
            setIsModelLoading(false);
            return llamaContext;
        } catch (error) {
            Alert.alert(
                'Error Loading Model',
                error instanceof Error ? error.message : 'An unknown error occurred.',
            );
            setIsModelLoading(false);
            return null;
        }
    }, [context]); // Include context in dependency array

    const releaseLlamaModel = useCallback(async () => {
        if (context) {
            await releaseAllLlama();
            setContext(null);
            setConversation(INITIAL_CONVERSATION);
            console.log("Llama model released.");
        }
    }, [context]);

    const generateChatCompletion = useCallback(
        async (userMessage: string): Promise<string | null> => {
            if (!context) {
                Alert.alert('Model Not Loaded', 'Please load a model first.');
                return null;
            }
            if (!userMessage.trim()) {
                Alert.alert('Input Error', 'Please enter a message.');
                return null;
            }

            const currentConversation: Message[] = [
                ...conversation,
                { role: 'user', content: userMessage },
            ];
            setConversation(currentConversation); // Show user message immediately
            setIsGenerating(true);

            try {
                const result = await context.completion({
                    messages: currentConversation, // Send the updated conversation
                    n_predict: 10000,
                    stop: CHAT_STOP_WORDS,
                });

                if (result && result.text) {
                    const assistantResponse = result.text.trim();
                    setConversation(prev => [
                        ...prev,
                        { role: 'assistant', content: assistantResponse },
                    ]);
                    return assistantResponse;
                } else {
                    throw new Error('No response from the model.');
                }
            } catch (error) {
                Alert.alert(
                    'Error During Inference',
                    error instanceof Error ? error.message : 'An unknown error occurred.',
                );
                return null;
            } finally {
                setIsGenerating(false);
            }
        },
        [context, conversation], // Add conversation to dependencies
    );

    return {
        context,
        isModelLoading,
        isGenerating,
        conversation,
        loadLlamaModel,
        releaseLlamaModel,
        generateChatCompletion,
        setConversation, // Expose if direct manipulation is needed elsewhere
    };
};
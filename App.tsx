import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import axios from 'axios';
import { downloadModel } from './src/api/model';
import ProgressBar from './src/components/ProgressBar';
import { initLlama, releaseAllLlama } from 'llama.rn';
import RNFS from 'react-native-fs'; // File system module

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const INITIAL_CONVERSATION: Message[] = [
  {
    role: 'system',
    content:
      'This is a conversation between user and assistant, a friendly chatbot.',
  },
];

function App(): React.JSX.Element {
  const [conversation, setConversation] = useState<Message[]>(INITIAL_CONVERSATION);
  const [selectedModelFormat, setSelectedModelFormat] = useState<string>('');
  const [selectedGGUF, setSelectedGGUF] = useState<string | null>(null);
  const [availableGGUFs, setAvailableGGUFs] = useState<string[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [context, setContext] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<
    'modelSelection' | 'conversation'
  >('modelSelection');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);

  const modelFormats = [
    { label: 'Llama-3.2-1B-Instruct' },
    { label: 'Qwen2-0.5B-Instruct' },
    { label: 'DeepSeek-R1-Distill-Qwen-1.5B' },
    { label: 'SmolLM2-1.7B-Instruct' },
  ];

  const HF_TO_GGUF = {
    "Llama-3.2-1B-Instruct": "medmekk/Llama-3.2-1B-Instruct.GGUF",
    "DeepSeek-R1-Distill-Qwen-1.5B":
      "medmekk/DeepSeek-R1-Distill-Qwen-1.5B.GGUF",
    "Qwen2-0.5B-Instruct": "medmekk/Qwen2.5-0.5B-Instruct.GGUF",
    "SmolLM2-1.7B-Instruct": "medmekk/SmolLM2-1.7B-Instruct.GGUF",
  };

  const fetchAvailableGGUFs = async (modelFormat: string) => {
    if (!modelFormat) {
      Alert.alert('Error', 'Please select a model format first.');
      return;
    }
    setIsFetching(true);
    try {
      const repoPath = HF_TO_GGUF[modelFormat as keyof typeof HF_TO_GGUF];
      if (!repoPath) {
        throw new Error(
          `No repository mapping found for model format: ${modelFormat}`,
        );
      }

      const response = await axios.get(
        `https://huggingface.co/api/models/${repoPath}`,
      );

      if (!response.data?.siblings) {
        throw new Error('Invalid API response format');
      }

      const files = response.data.siblings.filter((file: { rfilename: string }) =>
        file.rfilename.endsWith('.gguf'),
      );

      setAvailableGGUFs(files.map((file: { rfilename: string }) => file.rfilename));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch .gguf files';
      Alert.alert('Error', errorMessage);
      setAvailableGGUFs([]);
    }
    finally {
      setIsFetching(false);
    }
  };

  const handleDownloadModel = async (file: string) => {
    const downloadUrl = `https://huggingface.co/${HF_TO_GGUF[selectedModelFormat as keyof typeof HF_TO_GGUF]
      }/resolve/main/${file}`;
    setIsDownloading(true);
    setProgress(0);

    const destPath = `${RNFS.DocumentDirectoryPath}/${file}`;
    if (await checkFileExists(destPath)) {
      const success = await loadModel(file);
      if (success) {
        Alert.alert(
          "Info",
          `File ${destPath} already exists, we will load it directly.`
        );
        setIsDownloading(false);
        return;
      }
    }
    try {
      console.log("before download");
      console.log(isDownloading);

      const destPath = await downloadModel(file, downloadUrl, (progress) =>
        setProgress(progress)
      );
      Alert.alert("Success", `Model downloaded to: ${destPath}`);

      // After downloading, load the model
      await loadModel(file);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Download failed: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const loadModel = async (modelName: string) => {
    try {
      const destPath = `${RNFS.DocumentDirectoryPath}/${modelName}`;
      console.log("destPath : ", destPath);
      if (context) {
        await releaseAllLlama();
        setContext(null);
        setConversation(INITIAL_CONVERSATION);
      }
      const llamaContext = await initLlama({
        model: destPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 1,
      });
      setContext(llamaContext);
      Alert.alert("Model Loaded", "The model was successfully loaded.");
      return true;
    } catch (error) {
      console.log("error : ", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error Loading Model", errorMessage);
      return false;
    }
  };

  const handleSendMessage = async () => {
    // Check if context is loaded and user input is valid
    if (!context) {
      Alert.alert('Model Not Loaded', 'Please load the model first.');
      return;
    }

    if (!userInput.trim()) {
      Alert.alert('Input Error', 'Please enter a message.');
      return;
    }

    // Previous conversation added to the new message
    const newConversation: Message[] = [
      ...conversation,
      { role: 'user', content: userInput },
    ];
    setIsGenerating(true);
    // Update conversation state and clear user input
    setConversation(newConversation);
    setUserInput('');

    try {
      // we define list the stop words for all the model formats
      const stopWords = [
        '</s>',
        '<|end|>',
        'user:',
        'assistant:',
        '<|im_end|>',
        '<|eot_id|>',
        '<|end▁of▁sentence|>',
        '<｜end▁of▁sentence｜>',
      ];
      // now that we have the new conversation with the user message, we can send it to the model
      const result = await context.completion({
        messages: newConversation,
        n_predict: 10000,
        stop: stopWords,
      });

      if (result && result.text) {
        setConversation(prev => [
          ...prev,
          { role: 'assistant', content: result.text.trim() },
        ]);
      } else {
        throw new Error('No response from the model.');
      }
    } catch (error) {
      Alert.alert(
        'Error During Inference',
        error instanceof Error ? error.message : 'An unknown error occurred.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormatSelection = (format: string) => {
    setSelectedModelFormat(format);
    setAvailableGGUFs([]);
    fetchAvailableGGUFs(format);
  };

  const checkDownloadedModels = async () => {
    try {
      const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      const ggufFiles = files
        .filter((file) => file.name.endsWith(".gguf"))
        .map((file) => file.name);
      setDownloadedModels(ggufFiles);
    } catch (error) {
      console.error("Error checking downloaded models:", error);
    }
  };

  useEffect(() => {
    checkDownloadedModels();
  }, [currentPage]);

  const checkFileExists = async (filePath: string) => {
    try {
      const fileExists = await RNFS.exists(filePath);
      console.log("File exists:", fileExists);
      return fileExists;
    } catch (error) {
      console.error("Error checking file existence:", error);
      return false;
    }
  };

  const handleGGUFSelection = (file: string) => {
    setSelectedGGUF(file);
    Alert.alert(
      'Confirm Download',
      `Do you want to download ${file}?`,
      [
        {
          text: 'No',
          onPress: () => setSelectedGGUF(null),
          style: 'cancel',
        },
        { text: 'Yes', onPress: () => handleDownloadAndNavigate(file) },
      ],
      { cancelable: false },
    );
  };
  const handleDownloadAndNavigate = async (file: string) => {
    await handleDownloadModel(file);
    setCurrentPage('conversation'); // Navigate to conversation after download
  };

  const handleBackToModelSelection = () => {
    setContext(null);
    releaseAllLlama();
    setConversation(INITIAL_CONVERSATION);
    setSelectedGGUF(null);
    setCurrentPage("modelSelection");
  };


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          scrollEventThrottle={16}
        >
          <Text style={styles.title}>Llama Chat</Text>
          {currentPage === "modelSelection" && !isDownloading && (
            <View style={styles.card}>
              <Text style={styles.subtitle}>Choose a model format</Text>
              {modelFormats.map((format) => (
                <TouchableOpacity
                  key={format.label}
                  style={[
                    styles.button,
                    selectedModelFormat === format.label &&
                    styles.selectedButton,
                  ]}
                  onPress={() => handleFormatSelection(format.label)}
                >
                  <Text style={styles.buttonText}>{format.label}</Text>
                </TouchableOpacity>
              ))}
              {selectedModelFormat && (
                <View>
                  <Text style={styles.subtitle}>Select a .gguf file</Text>
                  {isFetching && (
                    <ActivityIndicator size="small" color="#2563EB" />
                  )}
                  {availableGGUFs.map((file, index) => {
                    const isDownloaded = downloadedModels.includes(file);
                    return (
                      <View key={index} style={styles.modelContainer}>
                        <TouchableOpacity
                          style={[
                            styles.modelButton,
                            selectedGGUF === file && styles.selectedButton,
                            isDownloaded && styles.downloadedModelButton,
                          ]}
                          onPress={() =>
                            isDownloaded
                              ? (loadModel(file),
                                setCurrentPage("conversation"),
                                setSelectedGGUF(file))
                              : handleGGUFSelection(file)
                          }
                        >
                          <View style={styles.modelButtonContent}>
                            <View style={styles.modelStatusContainer}>
                              {isDownloaded ? (
                                <View style={styles.downloadedIndicator}>
                                  <Text style={styles.downloadedIcon}>▼</Text>
                                </View>
                              ) : (
                                <View style={styles.notDownloadedIndicator}>
                                  <Text style={styles.notDownloadedIcon}>
                                    ▽
                                  </Text>
                                </View>
                              )}
                              <Text
                                style={[
                                  styles.buttonTextGGUF,
                                  selectedGGUF === file &&
                                  styles.selectedButtonText,
                                  isDownloaded && styles.downloadedText,
                                ]}
                              >
                                {file.split("-")[-1] == "imat"
                                  ? file
                                  : file.split("-").pop()}
                              </Text>
                            </View>
                            {isDownloaded && (
                              <View style={styles.loadModelIndicator}>
                                <Text style={styles.loadModelText}>
                                  TAP TO LOAD →
                                </Text>
                              </View>
                            )}
                            {!isDownloaded && (
                              <View style={styles.downloadIndicator}>
                                <Text style={styles.downloadText}>
                                  DOWNLOAD →
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
          {currentPage === "conversation" && !isDownloading && (
            <View style={styles.chatWrapper}>
              <Text style={styles.subtitle2}>Chatting with {selectedGGUF}</Text>
              <View style={styles.chatContainer}>
                <Text style={styles.greetingText}>
                  🦙 Welcome! The Llama is ready to chat. Ask away! 🎉
                </Text>
                {conversation.slice(1).map((msg, index) => (
                  <View key={index} style={styles.messageWrapper}>
                    <View
                      style={[
                        styles.messageBubble,
                        msg.role === "user"
                          ? styles.userBubble
                          : styles.llamaBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          msg.role === "user" && styles.userMessageText,
                        ]}
                      >
                        {msg.content}
                      </Text>
                    </View>

                  </View>
                ))}
              </View>
            </View>
          )}
          {isDownloading && (
            <View style={styles.card}>
              <Text style={styles.subtitle}>Downloading : </Text>
              <Text style={styles.subtitle2}>{selectedGGUF}</Text>
              <ProgressBar progress={progress} />
            </View>
          )}
        </ScrollView>
        <View style={styles.bottomContainer}>
          {currentPage === "conversation" && (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type your message..."
                    placeholderTextColor="#94A3B8"
                    value={userInput}
                    onChangeText={setUserInput}
                  />
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={handleSendMessage}
                    disabled={isGenerating}>
                    <Text style={styles.buttonText}>
                      {isGenerating ? 'Sending...' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackToModelSelection}
              >
                <Text style={styles.backButtonText}>
                  ← Back to Model Selection
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1E293B",
    marginVertical: 24,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    margin: 16,
    shadowColor: "#475569",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 16,
    marginTop: 16,
  },
  subtitle2: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 16,
    color: "#93C5FD",
  },
  button: {
    backgroundColor: "#93C5FD", // Lighter blue
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 6,
    shadowColor: "#93C5FD", // Matching lighter shadow color
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15, // Slightly reduced opacity for subtle shadows
    shadowRadius: 4,
    elevation: 2,
  },
  selectedButton: {
    backgroundColor: "#2563EB",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  chatWrapper: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    backgroundColor: "#3B82F6",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  messageWrapper: {
    marginBottom: 16,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: "80%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#3B82F6",
  },
  llamaBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  messageText: {
    fontSize: 16,
    color: "#334155",
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  tokenInfo: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "right",
  },
  inputContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#334155",
    minHeight: 50,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  sendButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: "#3B82F6",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
    alignSelf: "stretch",
    justifyContent: "center",
  },

  stopButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  greetingText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginVertical: 12,
    color: "#64748B", // Soft gray that complements #2563EB
  },
  thoughtContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#94A3B8",
  },
  thoughtTitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  thoughtText: {
    color: "#475569",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
  },
  toggleButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  toggleText: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "500",
  },

  bottomContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
  modelContainer: {
    marginVertical: 6,
    borderRadius: 12,
    overflow: "hidden",
  },

  modelButton: {
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    shadowColor: "#3B82F6",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  downloadedModelButton: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
    borderWidth: 1,
  },

  modelButtonContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modelStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  downloadedIndicator: {
    backgroundColor: "#DBEAFE",
    padding: 4,
    borderRadius: 6,
    marginRight: 8,
  },

  notDownloadedIndicator: {
    backgroundColor: "#F1F5F9",
    padding: 4,
    borderRadius: 6,
    marginRight: 8,
  },

  downloadedIcon: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "bold",
  },

  notDownloadedIcon: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "bold",
  },

  downloadedText: {
    color: "#1E40AF",
  },

  loadModelIndicator: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },

  loadModelText: {
    color: "#3B82F6",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  downloadIndicator: {
    backgroundColor: "#DCF9E5", // Light green background
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },

  downloadText: {
    color: "#16A34A", // Green text
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  buttonTextGGUF: {
    color: "#1E40AF",
    fontSize: 14,
    fontWeight: "500",
  },

  selectedButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

export default App;

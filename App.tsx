import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

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
  return <View> <Text>Hello World BE</Text> </View>;
}
const styles = StyleSheet.create({});

export default App;

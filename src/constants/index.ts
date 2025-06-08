import { Message } from '../types';

export const INITIAL_CONVERSATION: Message[] = [
    {
        role: 'system',
        content:
            'This is a conversation between user and assistant, a friendly chatbot.',
    },
];

export const MODEL_FORMATS = [
    { label: 'Llama-3.2-1B-Instruct' },
    { label: 'Qwen2-0.5B-Instruct' },
    { label: 'DeepSeek-R1-Distill-Qwen-1.5B' },
    { label: 'SmolLM2-1.7B-Instruct' },
];

export const HF_TO_GGUF_REPO: { [key: string]: string } = {
    "Llama-3.2-1B-Instruct": "medmekk/Llama-3.2-1B-Instruct.GGUF",
    "DeepSeek-R1-Distill-Qwen-1.5B":
        "medmekk/DeepSeek-R1-Distill-Qwen-1.5B.GGUF",
    "Qwen2-0.5B-Instruct": "medmekk/Qwen2.5-0.5B-Instruct.GGUF",
    "SmolLM2-1.7B-Instruct": "medmekk/SmolLM2-1.7B-Instruct.GGUF",
};

export const CHAT_STOP_WORDS = [
    '</s>',
    '<|end|>',
    'user:',
    'assistant:',
    '<|im_end|>',
    '<|eot_id|>',
    '<|end of sentence|>',
    '<｜end of sentence｜>',
];
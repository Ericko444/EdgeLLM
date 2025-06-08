import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { downloadModel } from '../api/model';
import ProgressBar from './ProgressBar';
import { MODEL_FORMATS, HF_TO_GGUF_REPO } from '../constants';

interface ModelSelectionScreenProps {
    onModelDownloaded: (modelFileName: string) => void;
    styles: any;
}

const ModelSelectionScreen: React.FC<ModelSelectionScreenProps> = ({
    onModelDownloaded,
    styles,
}) => {
    const [selectedModelFormat, setSelectedModelFormat] = useState<string>('');
    const [selectedGGUF, setSelectedGGUF] = useState<string | null>(null);
    const [availableGGUFs, setAvailableGGUFs] = useState<string[]>([]);
    const [isFetchingGGUFs, setIsFetchingGGUFs] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    const fetchAvailableGGUFs = useCallback(async (modelFormat: string) => {
        if (!modelFormat) {
            Alert.alert('Error', 'Please select a model format first.');
            return;
        }
        setIsFetchingGGUFs(true);
        setAvailableGGUFs([]); // Clear previous GGUFs
        try {
            const repoPath = HF_TO_GGUF_REPO[modelFormat];
            if (!repoPath) {
                throw new Error(`No repository mapping found for model format: ${modelFormat}`);
            }

            const response = await axios.get(`https://huggingface.co/api/models/${repoPath}`);
            if (!response.data?.siblings) {
                throw new Error('Invalid API response format');
            }
            const files = response.data.siblings
                .filter((file: { rfilename: string }) => file.rfilename.endsWith('.gguf'))
                .map((file: { rfilename: string }) => file.rfilename);
            setAvailableGGUFs(files);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch .gguf files';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsFetchingGGUFs(false);
        }
    }, []);

    const handleDownloadModel = useCallback(async (ggufFile: string) => {
        if (!selectedModelFormat) {
            Alert.alert('Error', 'Model format not selected.');
            return;
        }
        const repoPath = HF_TO_GGUF_REPO[selectedModelFormat];
        if (!repoPath) {
            Alert.alert('Error', `Repository not found for ${selectedModelFormat}`);
            return;
        }
        const downloadUrl = `https://huggingface.co/${repoPath}/resolve/main/${ggufFile}`;

        setIsDownloading(true);
        setDownloadProgress(0);
        setSelectedGGUF(ggufFile); // Keep track of what's being downloaded

        try {
            const destPath = await downloadModel(ggufFile, downloadUrl, progress =>
                setDownloadProgress(progress),
            );
            if (destPath) {
                onModelDownloaded(ggufFile); // Pass only the filename
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Download failed.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsDownloading(false);
        }
    }, [selectedModelFormat, onModelDownloaded]);

    const handleFormatSelection = (format: string) => {
        setSelectedModelFormat(format);
        setSelectedGGUF(null); // Reset GGUF selection
        fetchAvailableGGUFs(format);
    };

    const handleGGUFSelection = (file: string) => {
        Alert.alert(
            'Confirm Download',
            `Do you want to download ${file}?`,
            [
                { text: 'No', style: 'cancel', onPress: () => setSelectedGGUF(null) },
                { text: 'Yes', onPress: () => handleDownloadModel(file) },
            ],
            { cancelable: false },
        );
    };

    if (isDownloading && selectedGGUF) {
        return (
            <View style={styles.card}>
                <Text style={styles.subtitle}>Downloading: </Text>
                <Text style={styles.subtitle2}>{selectedGGUF}</Text>
                <ProgressBar progress={downloadProgress} />
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text style={styles.subtitle}>Choose a model format</Text>
            {MODEL_FORMATS.map(format => (
                <TouchableOpacity
                    key={format.label}
                    style={[
                        styles.button,
                        selectedModelFormat === format.label && styles.selectedButton,
                    ]}
                    onPress={() => handleFormatSelection(format.label)}>
                    <Text style={styles.buttonText}>{format.label}</Text>
                </TouchableOpacity>
            ))}
            {selectedModelFormat && (
                <View>
                    <Text style={styles.subtitle}>Select a .gguf file</Text>
                    {isFetchingGGUFs && <ActivityIndicator size="small" color="#2563EB" />}
                    {!isFetchingGGUFs && availableGGUFs.length === 0 && (
                        <Text>No .gguf files found or error fetching.</Text>
                    )}
                    {availableGGUFs.map((file, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.button,
                                selectedGGUF === file && styles.selectedButton,
                            ]}
                            onPress={() => handleGGUFSelection(file)}>
                            <Text style={styles.buttonTextGGUF}>{file}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

export default ModelSelectionScreen;
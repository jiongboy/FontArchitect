import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY is missing in environment variables.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

interface IdentificationResult {
    index: number;
    char: string;
}

export const identifyGlyphs = async (
    base64Images: string[]
): Promise<IdentificationResult[]> => {
    const client = getGeminiClient();
    if (!client) {
        throw new Error("API Key not configured");
    }

    try {
        const model = "gemini-2.5-flash"; 

        // Prepare the prompt
        // We send multiple images as parts.
        const parts: any[] = [];
        
        base64Images.forEach((b64) => {
           parts.push({
               inlineData: {
                   mimeType: "image/png",
                   data: b64
               }
           });
        });

        parts.push({
            text: `
                I have provided ${base64Images.length} images. Each image contains exactly one character (letter, number, or symbol).
                
                Please identify the character in each image in the exact order they were provided.
                
                Return a JSON array of strings, where each string is the character found. 
                If an image is just noise or unreadable, use empty string "".
                
                Example Output: ["A", "B", "C", "1", "?"]
            `
        });

        const response = await client.models.generateContent({
            model: model,
            contents: {
                parts: parts
            },
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || "[]";
        let charArray: string[] = [];
        try {
            charArray = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON from Gemini:", text);
            return [];
        }

        // Map back to results
        const results: IdentificationResult[] = charArray.map((char, idx) => ({
            index: idx,
            char: char
        }));

        return results;
    } catch (error) {
        console.error("Gemini Identification Failed:", error);
        throw error;
    }
};

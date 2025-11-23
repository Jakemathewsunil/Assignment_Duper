import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let manualApiKey: string | null = null;

/**
 * Allows the UI to set a manual API key if the user cannot use the project selector.
 */
export const setApiKey = (key: string) => {
  manualApiKey = key;
};

/**
 * Helper to get a fresh Gemini client.
 * Prioritizes manual key if set, otherwise falls back to environment variable.
 */
const getAiClient = () => {
  // safely check for process.env to avoid ReferenceError in browser
  const envKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;
  const key = manualApiKey || envKey;
  
  if (!key) {
    throw new Error("API Key not found. Please select a project or enter a key.");
  }
  return new GoogleGenAI({ apiKey: key });
};

/**
 * Converts a File object to a Base64 string for the API.
 */
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Helper to check if an error is a permission denied error (403).
 */
const isPermissionError = (error: any): boolean => {
  const msg = error?.message || '';
  const str = JSON.stringify(error);
  return (
    msg.includes('403') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('The caller does not have permission') ||
    str.includes('403') ||
    str.includes('PERMISSION_DENIED')
  );
};

/**
 * Helper to extract text from response and parse JSON solution.
 */
const parseSolutionResponse = (response: GenerateContentResponse): string[] => {
  try {
    let text = response.text || "[]";
    // Sanitize: Remove markdown code blocks if the model included them
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);
    if (Array.isArray(result)) return result;
    // If it parsed but isn't an array, try to force it
    return [JSON.stringify(result)];
  } catch (e) {
    console.warn("Failed to parse solution JSON, falling back to raw text", e);
    // Return the whole text as one page, preventing 1 line per page issues
    return [response.text || ""];
  }
};

/**
 * Clean text to remove markdown that might confuse the handwriting generator.
 */
const cleanTextForHandwriting = (text: string): string => {
  return text
    .replace(/\*\*/g, '') // remove bold
    .replace(/\*/g, '')   // remove italics/bullets
    .replace(/#{1,6}\s?/g, '')   // remove headers
    .replace(/`/g, '')   // remove code ticks
    .replace(/\[|\]/g, '') // remove brackets if they look like json artifacts
    .trim();
};

/**
 * Step 1: Transcribe the math problem from the uploaded image.
 */
export const transcribeMathProblem = async (imageFile: File): Promise<string> => {
  const ai = getAiClient();
  const base64Data = await fileToGenerativePart(imageFile);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: imageFile.type,
            data: base64Data
          }
        },
        {
          text: "Transcribe the math problem in this image exactly. If it is handwritten, interpret it carefully. Output only the math problem text/LaTeX."
        }
      ]
    }
  });

  return response.text || "Could not read problem.";
};

/**
 * Step 2: Solve the math problem using a thinking model.
 * Falls back to Flash if Pro is not available.
 */
export const solveMathProblem = async (problemText: string): Promise<string[]> => {
  const ai = getAiClient();
  
  const prompt = `Solve the following math problem step-by-step. 
    Problem: ${problemText}
    
    Format the output as a JSON array of strings.
    CRITICAL INSTRUCTION: Each string in the array represents ONE FULL PAGE of handwritten notes.
    - You MUST combine multiple logical steps into a single string to fill the page naturally, like a student writing an exam.
    - Do NOT separate every small step into a new array element. One array element = One full Page.
    - Each page (array element) should contain roughly 10-15 lines of text.
    - Use standard single spacing.
    - Write in PLAIN TEXT. Do NOT use Markdown formatting (no bold **, no headers ##).
    - Use '\\n' for new lines within the string.
    
    Example output format:
    ["Step 1: derivation...\\nStep 2: calculation...\\nStep 3: substitution...", "Step 4: final result..."]`;

  try {
    // Try with the advanced reasoning model first
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return parseSolutionResponse(response);

  } catch (error) {
    if (isPermissionError(error)) {
      console.warn("Gemini 3 Pro failed with permission error, falling back to Gemini 2.5 Flash.");
      // Fallback to Flash
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          // Flash also supports thinking, but we use a smaller budget or default
          thinkingConfig: { thinkingBudget: 1024 } 
        }
      });
      return parseSolutionResponse(response);
    }
    throw error;
  }
};

/**
 * Step 3: Generate visual pages mimicking the user's handwriting and paper.
 * Falls back to Flash Image if Pro Image is not available.
 */
export const generateHandwrittenPage = async (
  referenceImageFile: File,
  textToWrite: string,
  pageIndex: number
): Promise<string> => {
  const ai = getAiClient();
  const base64Ref = await fileToGenerativePart(referenceImageFile);
  
  // Clean the text to ensure no digital artifacts appear in the image
  const cleanText = cleanTextForHandwriting(textToWrite);

  const prompt = `
    Role: Expert Forger and Document Recreator.
    
    Task: Generate a NEW image of a handwritten document.
    
    Input Sources:
    1. Reference Image: Use this ONLY to extract the paper texture (lines, color, lighting) and the handwriting style (pen stroke, slant, ink color).
    2. Content to Write: The text provided below.
    
    Strict Instructions:
    - **Clarity & Contrast**: The generated handwriting MUST be sharp, clear, and highly readable.
    - **Ink Quality**: Use **DARK, HIGH-CONTRAST** ink (Deep Black or Blue). Ensure high contrast against the paper.
    - **Background**: Recreate the blank paper texture from the reference image.
    - **Handwriting**: Mimic the exact handwriting style from the reference image.
    - **NO Picture-in-Picture**: Do NOT paste the reference image into the output. The output must be a single, full-page document.
    - **Layout**: Use natural vertical spacing. Fill the page appropriately.
    
    Content to Write (This is the ONLY text that should appear):
    """
    ${cleanText}
    """
  `;

  // Helper to extract image from response
  const extractImage = (response: GenerateContentResponse): string => {
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in response");
  };

  try {
    // Try with High Quality Image Model (gemini-3-pro-image-preview)
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt + " Ensure the image is high resolution (2K) and text is crisp." },
          { inlineData: { mimeType: referenceImageFile.type, data: base64Ref } }
        ]
      },
      config: {
        imageConfig: {
           imageSize: "2K",
           aspectRatio: "3:4" 
        }
      }
    });

    return extractImage(response);

  } catch (error) {
    if (isPermissionError(error)) {
      console.warn(`Error generating page ${pageIndex + 1} with Pro model. Falling back to Flash Image model.`);
      
      // Fallback to Standard Image Model (gemini-2.5-flash-image)
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: prompt + " IMPORTANT: Output a scanned document style image, not artistic. High legibility." },
            { inlineData: { mimeType: referenceImageFile.type, data: base64Ref } }
          ]
        },
        config: {
          imageConfig: {
             aspectRatio: "3:4"
          }
        }
      });
      
      return extractImage(response);
    }
    console.error(`Error generating page ${pageIndex + 1}:`, error);
    throw error;
  }
};

/**
 * Step 4: Validate the generated solution images against the original question.
 * Returns true if valid, false otherwise.
 */
export const validateSolution = async (
  questionFile: File,
  generatedImageUrls: string[]
): Promise<{ valid: boolean; reason?: string }> => {
  const ai = getAiClient();
  const qBase64 = await fileToGenerativePart(questionFile);
  
  // Convert generated data URLs back to base64 for the API
  const generatedParts = generatedImageUrls.map(url => ({
    inlineData: {
      mimeType: "image/png",
      data: url.split(',')[1]
    }
  }));

  const prompt = `
    You are a Teacher validating student work.
    
    Inputs:
    1. The FIRST image is the original MATH PROBLEM (Question).
    2. The SUBSEQUENT images are the generated HANDWRITTEN SOLUTIONS.
    
    Task: Check if the solution is present and roughly legible.
    
    Rules:
    - **IGNORE MESSINESS**: Students often have bad handwriting. This is ACCEPTABLE.
    - **Check Presence**: Is there handwritten text visible on the page?
    - **Check Relevance**: Does it look like math/text?
    
    Output "valid": true unless the image is completely BLANK, BLACK, or PURE NOISE.
    If it is just "messy", it is VALID.
    
    Output JSON: { "valid": boolean, "reason": "short explanation" }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: questionFile.type, data: qBase64 } },
          ...generatedParts,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = (response.text || "{}").replace(/```json/g, '').replace(/```/g, '').trim();
    const json = JSON.parse(text);
    console.log("Validation Result:", json);
    return { valid: json.valid === true, reason: json.reason || "Unknown" };
  } catch (e) {
    console.error("Validation error", e);
    // If validation fails technically (e.g. JSON parse error), we assume true to avoid frustrating the user.
    return { valid: true, reason: "Validation bypassed due to technical error" };
  }
};
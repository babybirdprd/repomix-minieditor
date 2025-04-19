import path from 'path';
import { promises as fs } from 'fs';
import { generateCompressedCodebaseContext, generateTargetedUncompressedContext } from './repomixHandler.js';
import { readFileContent, applyCodeChanges } from './fileUtils.js';
import { parseXmlString, extractFilesFromRepomixXml, extractFilesFromSimpleChangesXml } from './xmlUtils.js';
import OpenAI from 'openai';
import { logger } from './logger.js';
import crypto from 'crypto';

export interface OrchestrateConfig {
  repoPath: string;
  docsPath: string;
  userTask: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  repomixConfig?: Partial<import('./repomixConfigUtils').RepomixConfigOptions>;
}

export async function orchestrateCodeModification({ repoPath, docsPath, userTask, apiKey, baseUrl, model, repomixConfig }: OrchestrateConfig): Promise<{ success: boolean; message: string }> {
  const tempDir = path.join(repoPath, 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const COMPRESSED_CONTEXT_OUTPUT = path.join(tempDir, 'compressed_context.xml');
  const TARGETED_CONTEXT_OUTPUT = path.join(tempDir, 'targeted_context.xml');
  const DOCUMENTATION_FILE = path.join(docsPath, 'api_docs.md');

  // Generate a unique run ID for this orchestration
  const runId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  logger.info({ runId, event: 'orchestrate_start', repoPath, docsPath, userTask }, 'Orchestration run started');

  // Step 1: Generate compressed codebase context (uses repomix.config.json in repoPath)
  await generateCompressedCodebaseContext(repoPath, COMPRESSED_CONTEXT_OUTPUT, repomixConfig);
  const compressedContext = await readFileContent(COMPRESSED_CONTEXT_OUTPUT);
  const documentationContent = await readFileContent(DOCUMENTATION_FILE);

  // Step 2: AI Call 1 - Identify files
  const ai1Prompt = `You are an AI codebase assistant. Based on the provided codebase context and documentation, identify the specific files that need to be modified or created to accomplish the user's task. Respond ONLY with a JSON object in the following format (no explanation, no markdown, no code block, just raw JSON):\n\n{"identifiedFiles": ["path/to/file1.js", "path/to/file2.js"]}\nCodebase Context (Compressed XML):\n${compressedContext}\nDocumentation:\n${documentationContent}\nUser Task: \"${userTask}\"`;

  logger.info({ runId, prompt: ai1Prompt }, 'AI Request 1 (identify files)');
  const openai = new OpenAI({ apiKey, baseURL: baseUrl });
  const aiResponse1 = await openai.chat.completions.create({
    model: model || 'deepseek-chat',
    messages: [{ role: 'user', content: ai1Prompt }],
    temperature: 0.2
  });
  logger.info({ runId, response: aiResponse1.choices[0].message?.content }, 'AI Response 1 (identify files)');

  // Helper: Extract JSON block from AI response (for identifiedFiles)
  function extractJsonBlock(text: string): string | null {
    // Remove code block markers if present
    const codeBlockMatch = text.match(/```(?:json)?([\s\S]*?)```/i);
    if (codeBlockMatch) {
      text = codeBlockMatch[1];
    }
    // Try to find the first {...} JSON object in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : null;
  }

  let identifiedFiles: string[] = [];
  // DEBUG: Log raw AI response
  const aiRawResponse = aiResponse1.choices[0].message?.content || '';
  console.log('AI raw response for identifiedFiles:', aiRawResponse);
  try {
    let jsonStr = aiRawResponse;
    // Try to extract JSON block if present
    const extracted = extractJsonBlock(aiRawResponse);
    if (extracted) jsonStr = extracted;
    identifiedFiles = JSON.parse(jsonStr).identifiedFiles;
  } catch (e) {
    console.error('Failed to extract identifiedFiles:', e, 'Raw response:', aiRawResponse);
    throw new Error('Failed to extract identifiedFiles from AI response');
  }
  if (!identifiedFiles || !Array.isArray(identifiedFiles) || identifiedFiles.length === 0) {
    throw new Error('AI did not identify any files for this task.');
  }

  // Step 3: Generate targeted uncompressed context
  await generateTargetedUncompressedContext(repoPath, identifiedFiles, TARGETED_CONTEXT_OUTPUT, repomixConfig);
  const targetedContext = await readFileContent(TARGETED_CONTEXT_OUTPUT);

  // Step 4: AI Call 2 - Generate code changes (XML)
  const ai2Prompt = `You are an AI codebase assistant. Based on the original task and the following uncompressed file contents and documentation, generate the necessary code modifications or new code.\n\nIMPORTANT:\n- Return the complete content of the modified file(s), even if you only changed one line.\n- Do NOT rewrite unrelated code or make unnecessary changes.\n- Only change what is required to accomplish the user's task.\n\nRespond ONLY with a single XML document, no explanation, no markdown, no code block, just raw XML in this format:\n\n<changes>\n  <file path=\"path/to/modified/file.js\">\n    <content>\n      // Complete content of the modified file\n    </content>\n  </file>\n  <file path=\"path/to/new/file.js\">\n     <content>\n       // Complete content of the new file\n     </content>\n  </file>\n</changes>\n\nUser Task: \"${userTask}\"\nDocumentation:\n${documentationContent}\nTargeted File Contents (Uncompressed XML):\n${targetedContext}`;

  logger.info({ runId, prompt: ai2Prompt }, 'AI Request 2 (generate code changes)');
  const aiResponse2 = await openai.chat.completions.create({
    model: model || 'deepseek-chat',
    messages: [{ role: 'user', content: ai2Prompt }],
    temperature: 0.2
  });
  logger.info({ runId, response: aiResponse2.choices[0].message?.content }, 'AI Response 2 (generate code changes)');

  // Step 5: Parse and apply code changes
  const parsedCodeChanges = await parseXmlString(aiResponse2.choices[0].message?.content || '');

  // Try both repomix and <changes> XML extraction
  let filesToApply = extractFilesFromRepomixXml(parsedCodeChanges?.changes);
  if (!filesToApply || Object.keys(filesToApply).length === 0) {
    // Fallback: try extracting from <changes> structure
    filesToApply = extractFilesFromSimpleChangesXml(parsedCodeChanges);
  }

  if (Object.keys(filesToApply).length > 0) {
    await applyCodeChanges(filesToApply, repoPath);
    return { success: true, message: 'Code modification workflow completed successfully.' };
  } else {
    return { success: false, message: 'AI generated no code changes to apply.' };
  }
}

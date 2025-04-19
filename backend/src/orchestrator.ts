import path from 'path';
import { generateCompressedCodebaseContext, generateTargetedUncompressedContext } from './repomixHandler.js';
import { readFileContent, applyCodeChanges } from './fileUtils.js';
import { parseXmlString, extractFilesFromRepomixXml } from './xmlUtils.js';
import OpenAI from 'openai';

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
  const COMPRESSED_CONTEXT_OUTPUT = path.join(repoPath, 'temp', 'compressed_context.xml');
  const TARGETED_CONTEXT_OUTPUT = path.join(repoPath, 'temp', 'targeted_context.xml');
  const DOCUMENTATION_FILE = path.join(docsPath, 'api_docs.md');

  // Step 1: Generate compressed codebase context (uses repomix.config.json in repoPath)
  await generateCompressedCodebaseContext(repoPath, COMPRESSED_CONTEXT_OUTPUT, repomixConfig);
  const compressedContext = await readFileContent(COMPRESSED_CONTEXT_OUTPUT);
  const documentationContent = await readFileContent(DOCUMENTATION_FILE);

  // Step 2: AI Call 1 - Identify files
  const ai1Prompt = `You are an AI assistant that helps with code modifications.\nHere is the compressed codebase context in XML format and the project documentation.\nAnalyze this context to understand the project structure and existing code.\nBased on the user's task, identify the specific files that need to be modified or created.\nProvide a list of these file paths in your response.\nCodebase Context (Compressed XML):\n${compressedContext}\nDocumentation:\n${documentationContent}\nUser Task: \"${userTask}\"\nIdentify the files required for this task and provide their paths.`;

  const openai = new OpenAI({ apiKey, baseURL: baseUrl });
  const aiResponse1 = await openai.chat.completions.create({
    model: model || 'gpt-4',
    messages: [{ role: 'user', content: ai1Prompt }],
    temperature: 0.2
  });
  let identifiedFiles: string[] = [];
  try {
    identifiedFiles = JSON.parse(aiResponse1.choices[0].message?.content || '{}').identifiedFiles;
  } catch {
    throw new Error('Failed to extract identifiedFiles from AI response');
  }
  if (!identifiedFiles || !Array.isArray(identifiedFiles) || identifiedFiles.length === 0) {
    throw new Error('AI did not identify any files for this task.');
  }

  // Step 3: Generate targeted uncompressed context
  await generateTargetedUncompressedContext(repoPath, identifiedFiles, TARGETED_CONTEXT_OUTPUT, repomixConfig);
  const targetedContext = await readFileContent(TARGETED_CONTEXT_OUTPUT);

  // Step 4: AI Call 2 - Generate code changes (XML)
  const ai2Prompt = `You are an AI assistant that modifies code.\nBased on the original task and the following uncompressed file contents and documentation,\ngenerate the necessary code modifications or new code in XML format.\nThe XML should clearly indicate file paths and their complete, modified or new content.\nRefer to the initial comprehensive codebase context you received previously for overall project understanding.\nUser Task: \"${userTask}\"\nDocumentation:\n${documentationContent}\nTargeted File Contents (Uncompressed XML):\n${targetedContext}\nGenerate the code changes in XML format. Example structure:\n<changes>\n  <file path=\"path/to/modified/file.js\">\n    <content>\n      // Complete content of the modified file\n    </content>\n  </file>\n  <file path=\"path/to/new/file.js\">\n     <content>\n       // Complete content of the new file\n     </content>\n  </file>\n</changes>`;

  const aiResponse2 = await openai.chat.completions.create({
    model: model || 'gpt-4',
    messages: [{ role: 'user', content: ai2Prompt }],
    temperature: 0.2
  });
  const generatedCodeXml = aiResponse2.choices[0].message?.content || '';

  // Step 5: Parse and apply code changes
  const parsedCodeChanges = await parseXmlString(generatedCodeXml);
  const filesToApply = extractFilesFromRepomixXml(parsedCodeChanges?.changes);
  if (Object.keys(filesToApply).length > 0) {
    await applyCodeChanges(filesToApply, repoPath);
    return { success: true, message: 'Code modification workflow completed successfully.' };
  } else {
    return { success: false, message: 'AI generated no code changes to apply.' };
  }
}

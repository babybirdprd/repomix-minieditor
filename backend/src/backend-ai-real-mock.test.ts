// Enhanced test script for orchestrateCodeModification with realistic mocks and a real code change.
// All dependencies are mocked in-memory for full isolation.

import path from 'path';
import fs from 'fs/promises';

// --- Realistic Mock OpenAI ---
class MockOpenAI {
  constructor(config: any) {}
  chat = {
    completions: {
      create: async (opts: any) => {
        const prompt = opts.messages?.[0]?.content || '';
        if (prompt.includes('identify the specific files')) {
          // Return a real file to be changed
          return {
            choices: [
              { message: { content: JSON.stringify({ identifiedFiles: ['src/hello.js'] }) } }
            ]
          };
        } else if (prompt.includes('Generate the code changes in XML format')) {
          // Return a real code change: modify hello.js to export a function
          // Use single quotes and escape all template literal syntax for valid TS
          return {
            choices: [
              { message: { content: `
<changes>\n  <file path=\"src/hello.js\">\n    <content>export function hello(name) {\n  return 'Hello, ' + name + '!';\n}\n</content>\n  </file>\n</changes>\n` } }
            ]
          };
        } else {
          return { choices: [ { message: { content: '' } } ] };
        }
      }
    }
  }
}

// --- Inline Orchestrator and Mocks ---
async function generateCompressedCodebaseContext(repoPath: string, outputPath: string) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, '<compressed></compressed>', 'utf8');
  return outputPath;
}
async function generateTargetedUncompressedContext(repoPath: string, filePaths: string[], outputPath: string) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, '<targeted></targeted>', 'utf8');
  return outputPath;
}
async function readFileContent(filePath: string) {
  return fs.readFile(filePath, 'utf8');
}
async function applyCodeChanges(fileChanges: { [key: string]: any }, repoPath: string) {
  for (const filePath in fileChanges) {
    const fullPath = path.join(repoPath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, fileChanges[filePath], 'utf8');
  }
}
async function parseXmlString(xml: string) {
  const files: { [key: string]: any } = {};
  const fileRegex = /<file path=\"([^\"]+)\">[\s\S]*?<content>([\s\S]*?)<\/content>[\s\S]*?<\/file>/g;
  let match;
  while ((match = fileRegex.exec(xml))) {
    files[match[1]] = match[2].trim();
  }
  return { changes: { file: Object.entries(files).map(([path, content]) => ({ path, content })) } };
}
function extractFilesFromRepomixXml(changes: any) {
  const files: { [key: string]: any } = {};
  if (Array.isArray(changes.file)) {
    for (const f of changes.file) {
      files[f.path] = f.content;
    }
  }
  return files;
}

async function orchestrateCodeModification(config: any) {
  const { repoPath, docsPath, userTask, apiKey, baseUrl, model } = config;
  const COMPRESSED_CONTEXT_OUTPUT = path.join(repoPath, 'temp', 'compressed_context.xml');
  const TARGETED_CONTEXT_OUTPUT = path.join(repoPath, 'temp', 'targeted_context.xml');
  const DOCUMENTATION_FILE = path.join(docsPath, 'api_docs.md');

  // Step 1: Generate compressed codebase context
  await generateCompressedCodebaseContext(repoPath, COMPRESSED_CONTEXT_OUTPUT);
  const compressedContext = await readFileContent(COMPRESSED_CONTEXT_OUTPUT);
  const documentationContent = await readFileContent(DOCUMENTATION_FILE);

  // Step 2: AI Call 1 - Identify files
  const ai1Prompt = `You are an AI assistant that helps with code modifications.\nHere is the compressed codebase context in XML format and the project documentation.\nAnalyze this context to understand the project structure and existing code.\nBased on the user's task, identify the specific files that need to be modified or created.\nProvide a list of these file paths in your response.\nCodebase Context (Compressed XML):\n${compressedContext}\nDocumentation:\n${documentationContent}\nUser Task: \"${userTask}\"\nIdentify the files required for this task and provide their paths.`;

  const openai = new MockOpenAI({ apiKey, baseURL: baseUrl });
  const aiResponse1 = await openai.chat.completions.create({
    model: model || 'gpt-4',
    messages: [{ role: 'user', content: ai1Prompt }],
    temperature: 0.2
  });
  let identifiedFiles = [];
  try {
    identifiedFiles = JSON.parse(aiResponse1.choices[0].message?.content || '{}').identifiedFiles;
  } catch {
    throw new Error('Failed to extract identifiedFiles from AI response');
  }
  if (!identifiedFiles || !Array.isArray(identifiedFiles) || identifiedFiles.length === 0) {
    throw new Error('AI did not identify any files for this task.');
  }

  // Step 3: Generate targeted uncompressed context
  await generateTargetedUncompressedContext(repoPath, identifiedFiles, TARGETED_CONTEXT_OUTPUT);
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

// --- Test Runner ---
async function runTest() {
  const config = {
    repoPath: './test-repo',
    docsPath: './test-repo',
    userTask: 'Change hello.js to export a hello(name) function that returns a greeting string.',
    apiKey: 'fake',
    baseUrl: '',
    model: 'gpt-4',
  };

  // Prepare fake file system state (create temp files/dirs and a hello.js file)
  await fs.mkdir('./test-repo/src', { recursive: true });
  // Start with a real hello world file
  await fs.writeFile('./test-repo/src/hello.js', 'export function hello() {\n  return \"Hello, world!\";\n}\n', 'utf8');
  await fs.mkdir('./test-repo/temp', { recursive: true });
  await fs.writeFile('./test-repo/temp/compressed_context.xml', '<compressed></compressed>', 'utf8');
  await fs.writeFile('./test-repo/api_docs.md', 'API DOCS', 'utf8');
  await fs.writeFile('./test-repo/temp/targeted_context.xml', '<targeted></targeted>', 'utf8');

  // Run orchestrateCodeModification
  try {
    const result = await orchestrateCodeModification(config);
    if (result.success) {
      // Verify the file was changed as expected
      const newContent = await fs.readFile('./test-repo/src/hello.js', 'utf8');
      if (newContent.includes("export function hello(name)") && newContent.includes("return 'Hello, ' + name + '!';")) {
        console.log('PASS: hello.js was updated from hello world to hello(name):', newContent.trim());
      } else {
        console.log('FAIL: hello.js was not updated as expected:', newContent.trim());
      }
    } else {
      console.log('FAIL:', result.message);
    }
  } catch (err) {
    console.error('ERROR:', err);
  }
}

runTest();

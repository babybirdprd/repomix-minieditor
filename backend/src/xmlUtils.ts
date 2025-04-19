// Utility functions for XML parsing
import { parseStringPromise, Builder } from 'xml2js';

/**
 * Parses an XML string into a JavaScript object.
 * @param xmlString - The XML content as a string.
 * @returns The parsed JavaScript object.
 * @throws If XML parsing fails.
 */
export async function parseXmlString(xmlString: string): Promise<any> {
  try {
    const result = await parseStringPromise(xmlString, { explicitArray: false });
    console.log('XML parsed successfully.');
    return result;
  } catch (error: any) {
    console.error(`Error parsing XML: ${error}`);
    throw new Error(`Failed to parse XML: ${error.message}`);
  }
}

/**
 * Builds an XML string from a JavaScript object.
 * Useful if you need to format data back into XML for any reason,
 * though the AI is expected to output XML directly.
 * @param jsObject - The JavaScript object to convert to XML.
 * @returns The XML string.
 */
export function buildXmlString(jsObject: any): string {
  const builder = new Builder();
  const xml = builder.buildObject(jsObject);
  return xml;
}

/**
 * Extracts file paths and content from parsed Repomix XML output.
 * This function assumes a specific XML structure from Repomix.
 * Assumed structure: <repository><repository_files><file><path>...</path><content>...</content></file>...</repository_files></repository>
 * @param parsedXml - The JavaScript object parsed from Repomix XML.
 * @returns An object where keys are file paths and values are file contents.
 */
export function extractFilesFromRepomixXml(parsedXml: any): Record<string, string> {
  const files: Record<string, string> = {};
  try {
    const repoFiles = parsedXml?.repository?.repository_files?.file;
    if (repoFiles) {
      const fileArray = Array.isArray(repoFiles) ? repoFiles : [repoFiles];
      fileArray.forEach((file: any) => {
        const filePath = file.path;
        const fileContent = file.content || '';
        if (filePath) {
          files[filePath] = fileContent;
        }
      });
    }
  } catch (error) {
    console.error('Error extracting files from Repomix XML:', error);
  }
  console.log(`Extracted ${Object.keys(files).length} files from Repomix XML.`);
  return files;
}

/**
 * Extracts file paths and content from <changes><file path><content>...</content></file></changes> XML output.
 * Used for fallback when AI returns non-repomix XML structure.
 * @param parsedXml - The parsed JS object from XML.
 * @returns An object where keys are file paths and values are file contents.
 */
export function extractFilesFromSimpleChangesXml(parsedXml: any): Record<string, string> {
  const files: Record<string, string> = {};
  try {
    const fileNodes = parsedXml?.changes?.file;
    if (fileNodes) {
      const fileArray = Array.isArray(fileNodes) ? fileNodes : [fileNodes];
      fileArray.forEach((file: any) => {
        // Support both <file path="..."> and <file><path>...</path></file>
        const filePath = file.path || file['@_path'] || (file['$'] && file['$'].path);
        const fileContent = file.content || '';
        if (filePath) {
          files[filePath] = fileContent;
        }
      });
    }
  } catch (error) {
    console.error('Error extracting files from <changes> XML:', error);
  }
  console.log(`Extracted ${Object.keys(files).length} files from <changes> XML.`);
  return files;
}

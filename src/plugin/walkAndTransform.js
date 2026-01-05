// plugin/walkAndTransform.js

import getTaggedTemplate from './taggedTemplate.js';

/**
 * Recursively walk through the AST and transform JSX nodes 
 */
export default function walkAndTransform(node) {
  if (!node || typeof node !== 'object') return node;

  if (Array.isArray(node)) {
    return node.map(walkAndTransform);
  }

  if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
    const result = getTaggedTemplate(node);
    return transformToAstNode(result);
  }

  const newNode = { ...node };
  for (const key in newNode) {
    if (Object.prototype.hasOwnProperty.call(newNode, key)) {
      newNode[key] = walkAndTransform(newNode[key]);
    }
  }
  return newNode;
}

/**
 * Maps the result of getTaggedTemplate into a valid AST node.
 * Note: Ensured that 'astring' correctly recognizes TemplateElement content
 * by guaranteeing value: { raw, cooked } structure and building (html`...`)("meta") format.
 */
function transformToAstNode(res) {
  if (typeof res === 'string') {
    return { type: 'Literal', value: res, raw: `'${res}'` };
  }
  
  if (res.type === 'TaggedTemplateExpression') {
    return {
      type: 'CallExpression',
      callee: {
        type: 'TaggedTemplateExpression',
        // tag name uses 'html' etc. passed from getTaggedTemplate
        tag: { type: 'Identifier', name: res.tag },
        quasi: {
          type: 'TemplateLiteral',
          quasis: res.template.strings.map(s => ({
            type: 'TemplateElement',
            // astring requires value: { raw, cooked } to output the content
            value: {
              raw: s.value.raw || '',
              cooked: s.value.cooked || ''
            },
            tail: s.tail
          })),
          expressions: res.template.expressions
        }
      },
      arguments: [{ type: 'Literal', value: res.meta, raw: `'${res.meta}'` }]
    };
  }
  return res;
}

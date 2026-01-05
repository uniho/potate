// plugin/taggedTemplate.js

import { t, createPath } from './babel-compat.js';
import {
  SELF_CLOSING_TAGS,
  PROPERTY_ATTRIBUTE_MAP,
} from './constants.js';
import {
  cleanStringForHtml,
  isHTMLElement,
  needsToBeExpression,
  isEmptyLiteralWrap,
  createAttributeExpression,
} from './utils.js';
import { isSvgHasDynamicPart } from './svg.js';
import {
  getPartMetaStringLiteral,
  getNonFragmentParent,
  isWrappedWithString,
  getPreviousSiblingIndex,
} from './partUtils.js';

function getLiteralParts(rootPath) {
  const strings = [];
  const expressions = [];
  const partsMeta = [];
  let stringPart = [];
  let elementCounter = 0;

  function pushToStrings(tail = false) {
    const string = stringPart.join('');
    strings.push({
      type: 'TemplateElement',
      value: { raw: string, cooked: string },
      tail
    });
    stringPart = [];
  }

  function pushToExpressions(expression, path, isAttribute) {
    // Finalize the current string part before adding an expression
    pushToStrings();
    
    const parent = getNonFragmentParent(path);
    // Reference the element counter (the element itself if it's an attribute)
    const refNodeIndex = isAttribute ? elementCounter - 1 : (parent ? parent.elementCounter : 0);

    let partMeta = { refNodeIndex, isAttribute };
    if (isAttribute) {
      partMeta.attributeIndex = path.node.staticAttributes ? path.node.staticAttributes.length : 0;
    } else {
      partMeta = { ...partMeta, ...getPreviousSiblingIndex(path) };
    }

    partsMeta.push(partMeta);
    expressions.push(expression);
  }

  function recursePath(path) {
    if (!path || !path.node) return;
    const { node } = path;

    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
      if (t.isJSXElement(node)) {
        const { openingElement } = node;
        const tagName = openingElement.name.name;

        if (isHTMLElement(tagName)) {
          node.elementCounter = elementCounter;
          node.staticAttributes = [];
          elementCounter += 1;

          stringPart.push(`<${tagName}`);

          openingElement.attributes.forEach((attr) => {
            if (t.isJSXSpreadAttribute(attr)) {
              const attrPath = createPath(attr, path);
              pushToExpressions(attr.argument, attrPath, true);
              stringPart.push(' ');
            } else {
              const { name, value } = attr;
              let attrName = name.name;
              if (needsToBeExpression(tagName, attrName) || (value && t.isJSXExpressionContainer(value))) {
                const expr = createAttributeExpression(name, value);
                const attrPath = createPath(attr, path);
                pushToExpressions(expr, attrPath, true);
                stringPart.push(' ');
              } else {
                attrName = PROPERTY_ATTRIBUTE_MAP[attrName] || attrName;
                let attrString = ` ${attrName}`;
                if (value) {
                  const attrValue = value.value;
                  const quote = attrValue.includes('"') ? `'` : `"`;
                  attrString = `${attrString}=${quote}${attrValue}${quote}`;
                }
                stringPart.push(attrString);
                node.staticAttributes.push(attr);
              }
            }
          });

          stringPart.push('>');

          const children = path.get('children');
          if (Array.isArray(children)) {
            children.forEach(child => recursePath(child));
          }

          if (!SELF_CLOSING_TAGS.includes(tagName)) {
            stringPart.push(`</${tagName}>`);
          }
          return;
        }
      }
      
      const children = path.get('children');
      if (Array.isArray(children)) {
        children.forEach(child => recursePath(child));
      }
    } else if (t.isJSXText(node)) {
      const cleanStr = cleanStringForHtml(node.value);
      if (cleanStr) stringPart.push(cleanStr);
    } else if (t.isJSXExpressionContainer(node) && !t.isJSXEmptyExpression(node.expression)) {
      // Prevent merging of expressions by inserting an empty string if wrapped
      if (isWrappedWithString(path)) {
        stringPart.push('');
      }
      pushToExpressions(node.expression, path, false);
    }
  }

  recursePath(rootPath);
  pushToStrings(true);

  return { strings, expressions, partsMeta };
}

export default function getTaggedTemplate(node) {
  const path = createPath(node);
  const { strings, expressions, partsMeta } = getLiteralParts(path);

  if (expressions.length === 1 && isEmptyLiteralWrap(strings)) {
    return expressions[0];
  }

  const metaStr = getPartMetaStringLiteral(partsMeta);

  return {
    type: 'TaggedTemplateExpression',
    tag: 'html',
    template: { strings, expressions },
    meta: metaStr
  };
}
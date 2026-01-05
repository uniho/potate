import { t } from './babel-compat.js';
import { cleanStringForHtml } from './utils.js';

function getSlimIndex(index) {
  return index === undefined || index === -1 ? '' : index;
}

function isValidTemplateElement(node) {
  return t.isJSXText(node) || node.elementCounter !== undefined;
}

export function flattenFragmentChildren(parent) {
  if (!parent || !parent.children) return [];
  const children = [];

  parent.children.forEach((node) => {
    if (t.isJSXFragment(node)) {
      children.push(...flattenFragmentChildren(node));
    } else {
      children.push(node);
    }
  });

  return children;
}

export function getPartMetaStringLiteral(partsMeta) {
  const partsMetaWithShortKeys = partsMeta.map((part) => {
    const { isAttribute } = part;
    let combinedBooleanCode;

    if (isAttribute) {
      combinedBooleanCode = 0;
    } else {
      combinedBooleanCode = part.hasExpressionSibling ? 2 : 1;
    }

    const primaryIndex = getSlimIndex(part.refNodeIndex);
    const secondaryIndex = getSlimIndex(isAttribute ? part.attributeIndex : part.prevChildIndex);

    return `${combinedBooleanCode}|${primaryIndex}|${secondaryIndex}`;
  });
  
  return partsMetaWithShortKeys.join(',');
}

export function getNonFragmentParent(path) {
  let currentPath = path;
  while (currentPath && currentPath.parentPath) {
    const parentNode = currentPath.parentPath.node;
    if (!t.isJSXFragment(parentNode)) {
      return parentNode;
    }
    currentPath = currentPath.parentPath;
  }
  return null;
}

export function getPreviousSiblingIndex(path) {
  const { node } = path;
  const parent = getNonFragmentParent(path);
  if (!parent) return { prevChildIndex: -1, hasExpressionSibling: false };

  const children = flattenFragmentChildren(parent);
  
  const nodeIndex = children.indexOf(node);
  if (nodeIndex === -1) return { prevChildIndex: -1, hasExpressionSibling: false };

  const validChildren = children.filter((child) => {
    if (t.isJSXText(child)) {
      return !!cleanStringForHtml(child.value);
    } else if (child.type === 'JSXExpressionContainer' && t.isJSXEmptyExpression(child.expression)) {
      return false;
    }
    return true;
  });

  const validNodeIndex = validChildren.indexOf(node);
  const prevSibling = validChildren[validNodeIndex - 1];

  const hasExpressionSibling = !!prevSibling && !isValidTemplateElement(prevSibling);

  let prevChildIndex = -1;
  for (let i = 0; i <= validNodeIndex; i++) {
    const child = validChildren[i];
    if (isValidTemplateElement(child) || (i > 0 && !isValidTemplateElement(validChildren[i - 1]))) {
      prevChildIndex += 1;
    }
  }

  return {
    prevChildIndex,
    hasExpressionSibling,
  };
}

export function isWrappedWithString(path) {
  const parent = getNonFragmentParent(path);
  if (!parent) return false;

  const children = flattenFragmentChildren(parent);
  const nodeIndex = children.indexOf(path.node);
  if (nodeIndex <= 0 || nodeIndex >= children.length - 1) return false;

  const prevNode = children[nodeIndex - 1];
  const nextNode = children[nodeIndex + 1];

  const isRenderableText = (n) => t.isJSXText(n) && !!cleanStringForHtml(n.value);

  return isRenderableText(prevNode) && isRenderableText(nextNode);
}
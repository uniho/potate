// plugin/babel-compat.js

export const t = {
  // Type Checkers
  isJSXElement: (node) => node?.type === 'JSXElement',
  isJSXText: (node) => node?.type === 'JSXText',
  isJSXExpressionContainer: (node) => node?.type === 'JSXExpressionContainer',
  isJSXFragment: (node) => node?.type === 'JSXFragment',
  isJSXEmptyExpression: (node) => node?.type === 'JSXEmptyExpression',
  isJSXSpreadAttribute: (node) => node?.type === 'JSXSpreadAttribute',
  isJSXAttribute: (node) => node?.type === 'JSXAttribute',
  isObjectExpression: (node) => node?.type === 'ObjectExpression',
  isJSXIdentifier: (node) => node?.type === 'JSXIdentifier',
  isJSXMemberExpression: (node) => node?.type === 'JSXMemberExpression',

  // Node Creators
  identifier: (name) => ({ type: 'Identifier', name }),
  stringLiteral: (value) => ({ type: 'Literal', value, raw: `'${value}'` }),
  nullLiteral: () => ({ type: 'Literal', value: null, raw: 'null' }),
  booleanLiteral: (value) => ({ type: 'Literal', value, raw: String(value) }),
  objectExpression: (properties) => ({ type: 'ObjectExpression', properties }),
  objectProperty: (key, value, computed = false, shorthand = false) => ({
    type: 'Property', key, value, computed, shorthand, kind: 'init'
  }),
  spreadElement: (argument) => ({ type: 'SpreadElement', argument }),
  callExpression: (callee, args) => ({ type: 'CallExpression', callee, arguments: args }),
  memberExpression: (object, property) => ({ type: 'MemberExpression', object, property }),
  taggedTemplateExpression: (tag, quasi) => ({ type: 'TaggedTemplateExpression', tag, quasi }),
  templateLiteral: (quasis, expressions) => ({ type: 'TemplateLiteral', quasis, expressions }),
  templateElement: (value, tail) => ({ type: 'TemplateElement', value, tail }),
};

/**
 * Cache to maintain node identity.
 * Allows for consistent path objects when traversing the same node.
 */
let pathCache = new WeakMap();

/**
 * Provides a way to reset the cache.
 * Can be called before a new transformation pass to ensure a clean state.
 */
export const clearPathCache = () => {
  pathCache = new WeakMap();
};

export const createPath = (node, parentPath = null) => {
  if (!node || typeof node !== 'object') return null;

  if (pathCache.has(node)) {
    const cachedPath = pathCache.get(node);
    // Update parentPath only if referenced from a different parent
    if (parentPath && cachedPath.parentPath !== parentPath) {
      cachedPath.parentPath = parentPath;
    }
    return cachedPath;
  }

  const path = {
    node,
    parentPath,
    get parent() {
      return this.parentPath ? this.parentPath.node : null;
    },
    get(key) {
      const val = this.node[key];
      if (Array.isArray(val)) {
        return val.map(child => createPath(child, this));
      }
      return createPath(val, this);
    }
  };

  pathCache.set(node, path);
  return path;
};
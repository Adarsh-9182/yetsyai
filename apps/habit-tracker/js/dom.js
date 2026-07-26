// Tiny DOM helpers — enough to build views declaratively without a framework.

/**
 * Create an element. Props map to attributes/properties; `class`, `text`,
 * `html`, `on*` event handlers, and `dataset` are handled specially.
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {(Node|string|null|undefined)[]} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== "list") {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Remove all children of a node. */
export function clear(node) {
  node.replaceChildren();
}

/** querySelector shorthand scoped to document or a root. */
export function $(sel, root = document) {
  return root.querySelector(sel);
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    constructor(_init?: string | number[]) {}
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(point: unknown) { return point; }
  }
  globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix;
}

if (typeof globalThis.Path2D === 'undefined') {
  class Path2D {
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    rect() {}
  }
  globalThis.Path2D = Path2D as unknown as typeof globalThis.Path2D;
}

if (typeof globalThis.DOMParser === 'undefined') {
  class SimpleElement {
    tagName: string
    textContent: string
    children: SimpleElement[]
    constructor(tagName: string, textContent: string) {
      this.tagName = tagName
      this.textContent = textContent
      this.children = []
    }
    querySelector() { return null }
    querySelectorAll() { return [] }
    getElementsByTagName() { return [] }
  }

  class DOMParser {
    parseFromString(html: string) {
      const children: SimpleElement[] = []
      const regex = /<([a-z0-9]+)[^>]*>(.*?)<\/\1>/gis
      let match: RegExpExecArray | null
      while ((match = regex.exec(html)) !== null) {
        const text = match[2].replace(/<[^>]+>/g, '').trim()
        if (text) {
          children.push(new SimpleElement(match[1], text))
        }
      }
      return {
        body: { children },
        getElementsByTagName: (name: string) => children.filter((c) => c.tagName.toLowerCase() === name.toLowerCase()),
        querySelectorAll: () => [],
      }
    }
  }
  globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
}

if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => 'blob:mock-url'
  URL.revokeObjectURL = () => {}
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  } as Storage
}


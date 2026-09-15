declare module 'bootstrap' {
  export class Modal {
    constructor(element: Element, options?: Record<string, unknown>);
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Modal | null;
  }

  export class Offcanvas {
    constructor(element: Element, options?: Record<string, unknown>);
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Offcanvas | null;
    static getOrCreateInstance(element: Element, options?: Record<string, unknown>): Offcanvas;
  }

  export class Tooltip {
    constructor(element: Element, options?: Record<string, unknown>);
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Tooltip | null;
    static getOrCreateInstance(element: Element, options?: Record<string, unknown>): Tooltip;
  }

  export class Collapse {
    constructor(element: Element, options?: Record<string, unknown>);
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Collapse | null;
    static getOrCreateInstance(element: Element, options?: Record<string, unknown>): Collapse;
  }
}

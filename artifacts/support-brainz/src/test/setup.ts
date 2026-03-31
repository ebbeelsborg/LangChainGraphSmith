import "@testing-library/jest-dom/vitest";

// jsdom does not implement scrollTo on elements
Element.prototype.scrollTo = function () {};

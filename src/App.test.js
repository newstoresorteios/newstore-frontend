import { SelectionContext } from "./selectionContext";

test("expõe o contexto compartilhado de seleção usado pela página principal", () => {
  expect(SelectionContext).toBeDefined();
  expect(SelectionContext.Provider).toBeDefined();
});

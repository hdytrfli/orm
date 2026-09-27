/** Compatibility barrel for the query type modules. */
export type {
  CursorMethod,
  HiddenDocumentKey,
  ModelDocument,
  StoredDocument,
  VisibleDocument,
} from './types/document.js';
export type { ModelFilter, ModelSort } from './types/filter.js';
export type {
  FieldSelection,
  FieldsDocument,
  SelectableKey,
  SelectedDocument,
} from './types/selection.js';
export type {
  PopulateSpec,
  PopulateSpecs,
  PopulateSpecsOnly,
  VirtualSpec,
  VirtualSpecs,
  ValidateVirtualSpecs,
  ValidatePopulateSpecs,
  PopulatedResult,
  PopulationMode,
  ScopeName,
} from './population/types.js';

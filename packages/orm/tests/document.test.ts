import { describe, expect, it } from 'vitest';

import {
  prepareDocument,
  prepareSoftDeletePatch,
  prepareUpdatePatch,
  splitUpsertDocument,
} from '../src/model/document.js';

const schema = (optionsConfig: { timestamps?: boolean; softdelete?: boolean }) => ({
  optionsConfig,
  parse: (input: unknown) => input,
  parsePartial: (input: unknown) => input,
});

describe('document persistence helpers', () => {
  it('prepares new documents with enabled managed fields', () => {
    const document = prepareDocument(schema({ timestamps: true, softdelete: true }), {
      name: 'Ada',
    });

    expect(document).toMatchObject({
      name: 'Ada',
      deletedAt: null,
    });
    expect(document._id).toBeDefined();
    expect(document.createdAt).toBeInstanceOf(Date);
    expect(document.updatedAt).toBeInstanceOf(Date);
  });

  it('strips caller-provided managed fields from updates and refreshes updatedAt', () => {
    const patch = prepareUpdatePatch(schema({ timestamps: true }), {
      name: 'Ada',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: new Date(0),
    });

    expect(patch.name).toBe('Ada');
    expect(patch.createdAt).toBeUndefined();
    expect(patch.deletedAt).toBeUndefined();
    expect(patch.updatedAt).toBeInstanceOf(Date);
    expect(patch.updatedAt).not.toEqual(new Date(0));
  });

  it('does not add a timestamp to updates when timestamps are disabled', () => {
    const patch = prepareUpdatePatch(schema({}), { name: 'Ada' });

    expect(patch).toEqual({ name: 'Ada' });
  });

  it('keeps the deletedAt and updatedAt fields synchronized in soft-delete patches', () => {
    const deletedAt = new Date('2026-01-01T00:00:00.000Z');
    const patch = prepareSoftDeletePatch(schema({ timestamps: true }), deletedAt);

    expect(patch.deletedAt).toBe(deletedAt);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });

  it('omits updatedAt from soft-delete patches when timestamps are disabled', () => {
    expect(prepareSoftDeletePatch(schema({}), null)).toEqual({ deletedAt: null });
  });

  it('splits insert-only and equality-filter fields from an upsert document', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const document = {
      email: 'ada@example.com',
      name: 'Ada',
      createdAt,
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      deletedAt: null,
    };

    const result = splitUpsertDocument(schema({ timestamps: true, softdelete: true }), document, {
      email: 'ada@example.com',
    });

    expect(result.set).toEqual({ name: 'Ada', updatedAt: document.updatedAt });
    expect(result.setOnInsert).toEqual({ createdAt, deletedAt: null });
  });
});

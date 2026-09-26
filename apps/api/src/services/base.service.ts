import { Model, ObjectId } from '@mongorm/orm';
import type { ModelFilter, ModelScopeName } from '@mongorm/orm';

import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/api-error';

type AnyModel = Model<any, any, any, any, any, any>;
type ModelShape<TModel> =
  TModel extends Model<infer Shape, any, any, any, any, any> ? Shape : never;
type ModelFilterFor<TModel> = ModelFilter<ModelShape<TModel>>;
type ModelDocument<TModel extends AnyModel> = Awaited<ReturnType<TModel['find']>>[number];
type CreateInput<TModel extends AnyModel> = Parameters<TModel['create']>[0];
type UpdateInput<TModel extends AnyModel> = Parameters<TModel['update']>[1];

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ListOptions {
  after?: string;
  limit: number;
}

export interface ServiceScopes<TModel> {
  list: ModelScopeName<TModel>;
  detail: ModelScopeName<TModel>;
}

export class BaseService<TModel extends AnyModel> {
  constructor(
    protected readonly model: TModel,
    private readonly scopes: ServiceScopes<TModel>,
    private readonly resourceName: string,
  ) {
    const availableScopes = model.features.scopes as readonly string[];
    if (!availableScopes.includes(scopes.list) || !availableScopes.includes(scopes.detail)) {
      throw new Error('List and detail scopes must be registered on ' + resourceName + ' model');
    }
  }

  get supportsSoftDelete(): boolean {
    return this.model.features.softDelete;
  }

  async list(
    filter: ModelFilterFor<TModel>,
    options: ListOptions,
  ): Promise<CursorPage<ModelDocument<TModel>>> {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
      throw new ValidationError('Page limit must be an integer between 1 and 100');
    }

    const after = options.after ? this.parseId(options.after) : undefined;
    const query = this.model.find(filter).with(this.scopes.list).limit(options.limit);
    const cursor = query.cursor(after);
    const items: ModelDocument<TModel>[] = [];

    for await (const item of cursor) items.push(item);

    return {
      items,
      nextCursor: cursor.next?.toHexString() ?? null,
    };
  }

  async findById(id: string): Promise<ModelDocument<TModel> | null> {
    const filter = { _id: this.parseId(id) } as ModelFilterFor<TModel>;
    return this.model.find(filter).with(this.scopes.detail).first();
  }

  create(input: CreateInput<TModel>): Promise<Awaited<ReturnType<TModel['create']>>> {
    return this.model.create(input) as unknown as Promise<Awaited<ReturnType<TModel['create']>>>;
  }

  async updateById(
    id: string,
    patch: UpdateInput<TModel>,
  ): Promise<Awaited<ReturnType<TModel['update']>>> {
    const filter = { _id: this.parseId(id) } as ModelFilterFor<TModel>;
    const updated = await this.model.update(filter, patch);
    if (!updated) throw new NotFoundError(this.resourceName);
    return updated as Awaited<ReturnType<TModel['update']>>;
  }

  async deleteById(id: string): Promise<void> {
    const filter = { _id: this.parseId(id) } as ModelFilterFor<TModel>;
    const result = await this.model.delete(filter);
    if (result.deletedCount === 0) throw new NotFoundError(this.resourceName);
  }

  async restoreById(id: string): Promise<ModelDocument<TModel>> {
    if (!this.supportsSoftDelete || typeof this.model.restore !== 'function') {
      throw new ConflictError(this.resourceName + ' does not support soft deletion');
    }

    const filter = { _id: this.parseId(id) } as ModelFilterFor<TModel>;
    const restore = this.model.restore as (
      filter: ModelFilterFor<TModel>,
    ) => Promise<ModelDocument<TModel> | null>;
    const restored = await restore.call(this.model, filter);
    if (!restored) throw new NotFoundError(this.resourceName);
    return restored;
  }

  private parseId(id: string): ObjectId {
    if (!ObjectId.isValid(id)) throw new ValidationError('The resource id is invalid');
    return new ObjectId(id);
  }
}

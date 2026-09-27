import { ObjectId } from '@mongorm/orm';
import type { AnyModel, CreateInputOf, FilterOf, ScopesOf, UpdateInputOf } from '@mongorm/orm';
import * as z from 'zod';

import { ConflictError, NotFoundError } from '@/libraries/errors';
import { paginationSchema } from '@/libraries/schemas';

export interface ServiceScopes<TModel extends AnyModel> {
  list: Extract<keyof ScopesOf<TModel>, string>;
  detail: Extract<keyof ScopesOf<TModel>, string>;
}

export class BaseService<TModel extends AnyModel> {
  private readonly name: string;
  protected readonly model: TModel;
  private readonly softdelete: boolean;
  private readonly scopes: ServiceScopes<TModel>;

  constructor({
    name,
    model,
    scopes,
    softdelete,
  }: {
    name: string;
    model: TModel;
    scopes: ServiceScopes<TModel>;
    softdelete: boolean;
  }) {
    this.name = name;
    this.model = model;
    this.scopes = scopes;
    this.softdelete = softdelete;
  }

  async list(options: z.infer<typeof paginationSchema>, filter: FilterOf<TModel> = {}) {
    const items = await this.model
      .find(filter)
      .with(this.scopes.list)
      .skip(options.skip)
      .limit(options.limit);

    return {
      items,
      skip: options.skip,
      limit: options.limit,
    };
  }

  async findById(id: ObjectId) {
    const result = await this.model.find({ _id: id }).with(this.scopes.detail).first();
    if (!result) throw new NotFoundError(this.name);
    return result;
  }

  async create(input: CreateInputOf<TModel>) {
    return this.model.create(input);
  }

  async updateById(id: ObjectId, patch: UpdateInputOf<TModel>) {
    const updated = await this.model.update({ _id: id }, patch);
    if (!updated) throw new NotFoundError(this.name);
    return updated;
  }

  async deleteById(id: ObjectId) {
    const result = await this.model.delete({ _id: id });
    if (result.deletedCount === 0) throw new NotFoundError(this.name);
  }

  async restoreById(id: ObjectId) {
    if (!this.softdelete) throw new ConflictError(this.name + ' does not support soft deletion');
    const restored = await this.model.restoreById(id);
    if (!restored) throw new NotFoundError(this.name);
    return restored;
  }
}

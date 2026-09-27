import type { AnyModel, ZodSchemaOf } from '@mongorm/orm';

import type { BaseService } from '@/common/base.service';
import type { ApiHandler } from '@/libraries/response';
import { paramsSchema } from '@/libraries/schemas';
import { paginationSchema } from '@/libraries/schemas';

export class BaseController<Model extends AnyModel, Service extends BaseService<Model>> {
  protected readonly service: Service;
  private readonly schema: ZodSchemaOf<Model>;

  constructor({ service, schema }: { service: Service; schema: ZodSchemaOf<Model> }) {
    this.service = service;
    this.schema = schema;
  }

  readonly list: ApiHandler = async (req, res) => {
    const pagination = paginationSchema.parse(req.query);
    const page = await this.service.list(pagination);

    res.json({
      success: true,
      data: page,
    });
  };

  readonly detail: ApiHandler = async (req, res) => {
    const { id } = paramsSchema.parse(req.params);
    const result = await this.service.findById(id);

    res.json({
      success: true,
      data: result,
    });
  };

  readonly create: ApiHandler = async (req, res) => {
    const input = this.schema.parse(req.body);
    const result = await this.service.create(input);

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  readonly update: ApiHandler = async (req, res) => {
    const { id } = paramsSchema.parse(req.params);
    const patch = this.schema.partial().parse(req.body);
    const result = await this.service.updateById(id, patch);

    res.json({
      success: true,
      data: result,
    });
  };

  readonly remove: ApiHandler = async (req, res) => {
    const { id } = paramsSchema.parse(req.params);
    await this.service.deleteById(id);

    res.json({
      success: true,
      data: {
        id: id.toHexString(),
      },
    });
  };

  readonly restore: ApiHandler = async (req, res) => {
    const { id } = paramsSchema.parse(req.params);
    const result = await this.service.restoreById(id);

    res.json({
      success: true,
      data: result,
    });
  };
}

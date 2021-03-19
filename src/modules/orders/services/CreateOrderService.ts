import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) throw new AppError('customer invalid');

    const realProducts = await this.productsRepository.findAllById(products);
    if (!realProducts) throw new AppError('products invalid');
    if (realProducts.length<products.length) throw new AppError('products invalid');

    const productsId = realProducts.map(product => product.id)

    const productsWOEnoughQuantity = productsId.some(productId => {
      const quantityAvailable = realProducts.find(product => product.id === productId)?.quantity
      const quantityNeeded = products.find(product => product.id === productId)?.quantity
      return quantityAvailable!<quantityNeeded!
    })
    if (productsWOEnoughQuantity) throw new AppError('not enough product');

    const productsForRepo = realProducts.map(product => {
      const quantity = products.find(productObj => productObj.id === product.id)
        ?.quantity as number;
      return {
        product_id: product.id,
        price: product.price,
        quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsForRepo,
    });

    const productsForUpdate = productsForRepo.map(product => ({
      id: product.product_id,
      quantity: product.quantity
    }))
    await this.productsRepository.updateQuantity(productsForUpdate)

    return order;
  }
}

export default CreateOrderService;

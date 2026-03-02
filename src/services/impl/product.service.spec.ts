import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;

	beforeEach(async () => {
		({databaseMock, databaseName} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => cleanUp(databaseName));

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, {eq}) => eq(product.id, product.id),
		});
		expect(result).toEqual(product);
	});

	const productsToTest: Array<Product & { expectedAvailableAfterOrder: number }> = [
		{
		id: 1,
		available: 5,
		leadTime: 2,
		name: 'Chair 2450',
		type: 'NORMAL',
		expiryDate: null,
		seasonStartDate: null,
		seasonEndDate: null,
		expectedAvailableAfterOrder: 4,
		},
		{
		id: 2,
		available: 5,
		leadTime: 2,
		name: 'Kiwi',
		type: 'SEASONAL',
		expiryDate: null,
		seasonStartDate: null,
		seasonEndDate: null,
		expectedAvailableAfterOrder: 4,
		},
		{
		id: 3,
		available: 5,
		leadTime: 0,
		name: 'Milk',
		type: 'EXPIRED',
		expiryDate: null,
		seasonStartDate: null,
		seasonEndDate: null,
		expectedAvailableAfterOrder: 4,
		},
	];

	productsToTest.forEach((p) => {
		it(`should decrease available correctly for ${p.type} product`, async () => {
			await databaseMock.insert(products).values(p);

			if (p.type === 'NORMAL') await productService.handleNormalProduct(p);
			if (p.type === 'SEASONAL') await productService.handleSeasonalProduct(p);
			if (p.type === 'EXPIRED') await productService.handleExpiredProduct(p);

			const updated_p = await databaseMock.query.products.findFirst({
			where: (prod, { eq }) => eq(prod.id, p.id),
			});

			expect(updated_p!.available).toBe(p.expectedAvailableAfterOrder);
			});
		});
	
});


import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: 'dashboard',
		loadComponent: () => import('./features/dashboard/dashboard.page').then((page) => page.DashboardPage),
		title: 'Overview | Ledger',
	},
	{
		path: 'transactions',
		loadComponent: () => import('./features/transactions/transactions.page').then((page) => page.TransactionsPage),
		title: 'Transactions | Ledger',
	},
	{
		path: 'analytics',
		loadComponent: () => import('./features/analytics/analytics.page').then((page) => page.AnalyticsPage),
		title: 'Analytics | Ledger',
	},
	{
		path: 'income',
		loadComponent: () => import('./features/income/income.page').then((page) => page.IncomePage),
		title: 'Income | Ledger',
	},
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{ path: '**', redirectTo: 'dashboard' },
];

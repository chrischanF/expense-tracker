import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: 'dashboard',
		loadComponent: () => import('./features/dashboard/dashboard.page').then((page) => page.DashboardPage),
		title: 'Overview | PennyWise',
	},
	{
		path: 'transactions',
		loadComponent: () => import('./features/transactions/transactions.page').then((page) => page.TransactionsPage),
		title: 'Transactions | PennyWise',
	},
	{
		path: 'analytics',
		loadComponent: () => import('./features/analytics/analytics.page').then((page) => page.AnalyticsPage),
		title: 'Analytics | PennyWise',
	},
	{
		path: 'income',
		loadComponent: () => import('./features/income/income.page').then((page) => page.IncomePage),
		title: 'Income | PennyWise',
	},
	{
		path: 'recurring',
		loadComponent: () => import('./features/recurring/recurring.page').then((page) => page.RecurringPage),
		title: 'Recurring | PennyWise',
	},
	{
		path: 'budgets',
		loadComponent: () => import('./features/budgets/budgets.page').then((page) => page.BudgetsPage),
		title: 'Budgets | PennyWise',
	},
	{
		path: 'goals',
		loadComponent: () => import('./features/goals/goals.page').then((page) => page.GoalsPage),
		title: 'Savings Goals | PennyWise',
	},
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{ path: '**', redirectTo: 'dashboard' },
];

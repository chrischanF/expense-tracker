# Webapp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Firebase login and expense sync

1. Create a Firebase project and register a web app.
2. Enable Google under **Authentication > Sign-in method** and create a Cloud Firestore database.
3. Copy the web app settings into `src/environments/environment.ts` (`firebaseConfig`). These client settings identify the Firebase project; secure the database with the included `firestore.rules`.
4. From this `webapp` directory, run `npm run build` followed by `firebase deploy`. The included `firebase.json` deploys the Angular browser build and Firestore rules, while `.firebaserc` selects the configured Firebase project. The rules restrict expense reads and writes to the authenticated user's own `users/{uid}/expenses` collection.

Expenses are saved in browser local storage immediately. When signed in, queued creates, edits, and deletes sync to Firestore when connectivity is available. Guest expenses are kept locally and queued for that account when the user signs in.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

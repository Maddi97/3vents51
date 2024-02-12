// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  //apiBaseUrl: "https://backend.staging.evento-leipzig.de",
  //apiBaseUrl: "https://backend.evento-leipzig.de",
  apiBaseUrlBrowser: "http://localhost:3000",
  apiBaseUrlServer: "http://localhost:3000",

  /* Für Android App Testing*/
  //apiBaseUrl: "http://172.20.10.3:3000"
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.

//import { inspect } from "@xstate/inspect";
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./Main";
import reportWebVitals from "./reportWebVitals";
import { debug } from "./util";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

/*
inspect({
  // options
  url: 'https://statecharts.io/inspect', // (default)
  iframe: false // open in new window
});*/

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals((metric) => {
  try {
    const body = JSON.stringify(metric);
    const url = "https://pgapi.siid.sh/metrics";
    debug(body);
    // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { body, method: "POST", keepalive: true });
    }
  } catch (e) {
    debug(e, metric);
  }
});

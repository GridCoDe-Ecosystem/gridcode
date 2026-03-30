"use strict";

import { CWindow } from "/lib/window.js";
import { executeAction } from "/store_v1/engine/StoreVault.js";
import { SimAdapter } from "/store_v1/adapter/SimAdapter.js";

export default class CStoreGrid extends CWindow {

    constructor(...args) {
        super(...args);

        this.adapter = new SimAdapter();

        this.state = {
            listing: null,
            status: "Initializing..."
        };

        this.onTest = this.onTest.bind(this);
    }

    async init() {
        this.render();
    }

    render() {
        const body = this.getBody();

        body.innerHTML = `
            <div style="padding:20px">
                <h2>GridCoDe Store v1</h2>
                <button id="btn-test">Run Test</button>
                <div id="output">Ready</div>
            </div>
        `;

        this.getControl("btn-test").addEventListener("click", this.onTest);
    }

    async onTest() {
        const output = this.getControl("output");

        try {
            output.innerText = "Running...";

            // Minimal safe test (no real engine call yet)
            const result = "UI + Adapter Ready";

            output.innerText = result;

        } catch (err) {
            output.innerText = "Error: " + err.message;
        }
    }

    closeWindow() {
        const vm = CVMContext.getInstance();
        vm.unregisterEventListenerByID(this.mID);
        super.closeWindow();
    }
}

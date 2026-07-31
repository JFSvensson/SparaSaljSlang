"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const auth_1 = require("../src/auth");
(0, node_test_1.default)('authenticateUser accepts matching credentials', () => {
    strict_1.default.equal((0, auth_1.authenticateUser)('admin', 'change-me'), true);
});
(0, node_test_1.default)('authenticateUser rejects mismatched credentials', () => {
    strict_1.default.equal((0, auth_1.authenticateUser)('wrong', 'wrong'), false);
});

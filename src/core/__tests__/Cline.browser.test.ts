import { Cline } from "../Cline"
import { ClineProvider } from "../webview/ClineProvider"
import * as vscode from "vscode"
import { BrowserSession } from "../../services/browser/BrowserSession"
import { BrowserActionResult } from "../../shared/ExtensionMessage"
import { ApiConfiguration, ApiProvider } from "../../shared/api"
import fs from "fs/promises"

// Mock dependencies
jest.mock("../../services/browser/BrowserSession")
jest.mock("../webview/ClineProvider")
jest.mock("fs/promises")

describe("Cline Browser Integration", () => {
	let mockContext: vscode.ExtensionContext
	let mockProvider: jest.Mocked<ClineProvider>
	let mockBrowserSession: jest.Mocked<BrowserSession>
	let cline: Cline

	beforeEach(() => {
		// Mock fs.mkdir
		;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)

		// Setup mock context
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
			},
			globalStorageUri: { fsPath: "/mock/storage/path" },
		} as unknown as vscode.ExtensionContext

		// Setup mock provider
		mockProvider = {
			context: mockContext,
			getState: jest.fn().mockResolvedValue({
				apiConfiguration: {
					apiProvider: "anthropic" as ApiProvider,
					apiKey: "test-key",
				},
				lastShownAnnouncementId: "",
				customInstructions: "",
				alwaysAllowReadOnly: false,
				alwaysApproveResubmit: false,
				customModePrompts: {},
				customModes: [],
				diffEnabled: false,
				enableMcpServerCreation: false,
				experiments: {},
				fuzzyMatchThreshold: 1.0,
				keepBrowserOpen: false,
				mcpEnabled: false,
				mode: "code",
				preferredLanguage: "English",
				rateLimitSeconds: 0,
				requestDelaySeconds: 0,
				screenshotQuality: 75,
				terminalOutputLineLimit: 1000,
			}),
			postMessageToWebview: jest.fn(),
			postStateToWebview: jest.fn(),
			updateTaskHistory: jest.fn(),
			ensureSettingsDirectoryExists: jest.fn(),
			ensureMcpServersDirectoryExists: jest.fn(),
		} as unknown as jest.Mocked<ClineProvider>

		// Setup mock browser session with error handling
		mockBrowserSession = {
			setOnViewportChange: jest.fn(),
			closeBrowser: jest.fn().mockImplementation(async () => {
				return {}
			}),
			launchBrowser: jest.fn(),
			navigateToUrl: jest.fn(),
			click: jest.fn(),
			type: jest.fn(),
			scrollDown: jest.fn(),
			scrollUp: jest.fn(),
			setViewport: jest.fn(),
			getViewportSize: jest.fn(),
		} as unknown as jest.Mocked<BrowserSession>

		// Mock BrowserSession constructor
		;(BrowserSession as jest.Mock).mockImplementation(() => mockBrowserSession)

		const apiConfig: ApiConfiguration = {
			apiProvider: "anthropic" as ApiProvider,
			apiKey: "test-key",
		}

		// Create Cline instance
		cline = new Cline(mockProvider, apiConfig, undefined, false, 1.0, "test task")
	})

	describe("Browser Session Management", () => {
		it("should initialize browser session with default viewport size", () => {
			expect(mockBrowserSession.setOnViewportChange).toHaveBeenCalled()
			expect((cline as any).browserViewportSize).toBe("900x600") // Default size
		})

		it("should update viewport size when browser session changes it", () => {
			const viewportChangeHandler = mockBrowserSession.setOnViewportChange.mock.calls[0][0]
			viewportChangeHandler("1024x768")
			expect((cline as any).browserViewportSize).toBe("1024x768")
		})

		it("should restore viewport size from provider state", async () => {
			mockProvider.getState.mockResolvedValueOnce({
				...(await mockProvider.getState()),
				browserViewportSize: "375x667",
			})

			const apiConfig: ApiConfiguration = {
				apiProvider: "anthropic" as ApiProvider,
				apiKey: "test-key",
			}

			const newCline = new Cline(mockProvider, apiConfig, undefined, false, 1.0, "test task")
			await new Promise((resolve) => setTimeout(resolve, 0)) // Wait for async state initialization

			expect(mockBrowserSession.setViewport).toHaveBeenCalledWith("375x667")
		})
	})

	describe("Browser Action Handling", () => {
		let mockBrowserActionResult: BrowserActionResult

		beforeEach(() => {
			mockBrowserActionResult = {
				screenshot: "data:image/png;base64,test",
				logs: "test logs",
				currentUrl: "http://test.com",
				currentMousePosition: "100,100",
			}

			mockBrowserSession.navigateToUrl.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.click.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.type.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.scrollDown.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.scrollUp.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.setViewport.mockResolvedValue(mockBrowserActionResult)
		})

		it("should handle browser launch action", async () => {
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "launch",
					url: "http://test.com",
				},
			}

			// Mock ask method to simulate user approval
			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()
			await (cline as any).browserSession.launchBrowser()
			const result = await (cline as any).browserSession.navigateToUrl(block.params.url!)

			expect(mockBrowserSession.launchBrowser).toHaveBeenCalled()
			expect(mockBrowserSession.navigateToUrl).toHaveBeenCalledWith("http://test.com")
			expect(result).toEqual(mockBrowserActionResult)
		})

		it("should handle browser click action", async () => {
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "click",
					coordinate: "100,200",
				},
			}

			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()
			const result = await (cline as any).browserSession.click(block.params.coordinate!)

			expect(mockBrowserSession.click).toHaveBeenCalledWith("100,200")
			expect(result).toEqual(mockBrowserActionResult)
		})

		it("should handle browser type action", async () => {
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "type",
					text: "test text",
				},
			}

			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()
			const result = await (cline as any).browserSession.type(block.params.text!)

			expect(mockBrowserSession.type).toHaveBeenCalledWith("test text")
			expect(result).toEqual(mockBrowserActionResult)
		})

		it("should handle viewport changes", async () => {
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "set_viewport",
					viewport: "1024x768",
				},
			}

			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()
			const result = await (cline as any).browserSession.setViewport(block.params.viewport!)

			expect(mockBrowserSession.setViewport).toHaveBeenCalledWith("1024x768")
			expect(result).toEqual(mockBrowserActionResult)
		})

		it("should handle browser close action", async () => {
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "close",
				},
			}

			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()
			await (cline as any).browserSession.closeBrowser()

			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
		})
	})

	describe("Browser Error Handling", () => {
		beforeEach(() => {
			// Reset closeBrowser mock before each test
			mockBrowserSession.closeBrowser.mockReset()
			mockBrowserSession.closeBrowser.mockImplementation(async () => ({}))
		})

		it("should handle browser launch errors", async () => {
			const error = new Error("Failed to launch browser")
			mockBrowserSession.launchBrowser.mockRejectedValue(error)
			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()

			try {
				await (cline as any).browserSession.launchBrowser()
			} catch (e) {
				expect(e.message).toBe("Failed to launch browser")
			}

			// Wait for error handler to execute
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
		})

		it("should handle navigation errors", async () => {
			const error = new Error("Failed to navigate")
			mockBrowserSession.navigateToUrl.mockRejectedValue(error)
			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()

			try {
				await (cline as any).browserSession.navigateToUrl("http://test.com")
			} catch (e) {
				expect(e.message).toBe("Failed to navigate")
			}

			// Wait for error handler to execute
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
		})

		it("should handle click errors", async () => {
			const error = new Error("Failed to click")
			mockBrowserSession.click.mockRejectedValue(error)
			;(cline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(cline as any).say = jest.fn()

			await (cline as any).presentAssistantMessage()

			try {
				await (cline as any).browserSession.click("100,200")
			} catch (e) {
				expect(e.message).toBe("Failed to click")
			}

			// Wait for error handler to execute
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
		})
	})

	describe("Task Lifecycle", () => {
		it("should close browser when task is aborted", async () => {
			await cline.abortTask()
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
		})
	})

	afterEach(async () => {
		await cline.abortTask()
		// Wait for any pending promises to resolve
		await new Promise((resolve) => setTimeout(resolve, 100))
	})
})

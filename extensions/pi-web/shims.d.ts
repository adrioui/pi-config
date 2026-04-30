declare module "turndown" {
	class TurndownService {
		constructor(options?: any);
		turndown(input: string): string;
	}

	export default TurndownService;
}

declare module "@mariozechner/pi-coding-agent" {
	export interface ExtensionAPI {
		on(event: string, handler: (...args: any[]) => any): void;
		registerTool(tool: {
			name: string;
			label: string;
			description: string;
			promptSnippet?: string;
			promptGuidelines?: string[];
			parameters: any;
			execute: (...args: any[]) => any;
			renderCall?: (...args: any[]) => any;
		}): void;
		appendEntry(customType: string, data: unknown): void;
	}
}

declare module "@mariozechner/pi-tui" {
	export class Text {
		constructor(text: string, x?: number, y?: number);
	}
}

declare module "@mariozechner/pi-ai" {
	export function StringEnum(values: readonly string[], options?: any): any;
}

declare module "@sinclair/typebox" {
	export const Type: {
		Object(...args: any[]): any;
		Optional(...args: any[]): any;
		String(...args: any[]): any;
		Array(...args: any[]): any;
		Number(...args: any[]): any;
		Boolean(...args: any[]): any;
	};
}

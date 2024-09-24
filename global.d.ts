export {};

declare global {
	interface Question {
		q: string;
		a: string;
		category: string;
		caseInsensitive?: true;
	}
}

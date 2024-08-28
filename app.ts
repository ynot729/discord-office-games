import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { generateSlug } from "random-word-slugs";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildMessages,
	],
});

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
const intervalMinutes = process.env.INTERVAL_MINUTES
	? parseInt(process.env.INTERVAL_MINUTES)
	: 5;

if (!token) throw new Error("ENV needs to have DISCORD_TOKEN");
if (!channelId) throw new Error("ENV needs to have CHANNEL_ID");

let channel: TextChannel;
client.once("ready", async () => {
	console.log("Bot is online!");
	channel = client.channels.cache.get(channelId) as TextChannel;
	if (!channel) return console.error("Channel not found!");
	await loadStanding();
	// await channel.send("Hello, world!");
	// sendRandomMessage();
	askQuestion();
	setInterval(askQuestion, intervalMinutes * 60 * 1000);
});

interface Question {
	q: string | (() => string) | (() => { q: string; a: string });
	a: string | (() => string);
}
let currentQuestion: Question | null = null;
const questions: Question[] = [
	// { q: "Say hello", a: "hello" },
	// { q: "Say world", a: "world" },
	{
		q: () => {
			const a = Math.floor(Math.random() * 100);
			const b = Math.floor(Math.random() * 100);
			return { q: `What is \`${a} + ${b}\`?`, a: `${a + b}` };
		},
		a: "calculated",
	},
	{
		q: () => {
			const thingToSay = generateSlug(3, { format: "sentence" });
			return {
				q: `Say: \`${thingToSay.toLowerCase()}\` in uppercase`,
				a: thingToSay.toUpperCase(),
			};
		},
		a: "calculated",
	},
];
const standings: Record<string, number> = {};

async function loadStanding() {
	try {
		//@ts-ignore the file might not be there on first run
		const loadedStandings = await import("./standings.json");
		Object.assign(standings, loadedStandings.default);
		console.log("Standings loaded!");
		console.log(standings);
	} catch (error) {
		console.error("No standings found");
	}
}

client.on("messageCreate", async (message) => {
	if (message.channel.id === channelId) {
		const msgDtls = await message.fetch();
		const providedAnswer = msgDtls.content;

		const name = msgDtls.member?.displayName ?? msgDtls.author.displayName;
		// console.log(`Message from: ${name}`);

		if (name == "office games") return; // no need to respond when we sent the message

		if (currentQuestion) {
			if (currentQuestion.a === providedAnswer) {
				console.log(msgDtls.author.displayName);

				console.log(`Correct answer '${providedAnswer}' from: ${name}`);

				if (!standings[name]) standings[name] = 0;
				standings[name]++;

				currentQuestion = null;

				msgDtls.react("✅");
				saveStandings();
			} else {
				msgDtls.react("❌");
				console.log(
					`Inorrect answer '${providedAnswer}' != '${currentQuestion.a}' from: ${name}`
				);
			}
		}

		if (providedAnswer == "standings") {
			const standingsMsg = Object.entries(standings)
				.map(([name, score]) => `${name}: ${score}`)
				.join("\n");
			channel.send("```\n" + standingsMsg + "\n```");
		}
	}
});

function askQuestion() {
	console.log("Asking question ...");
	const questionN = Math.floor(Math.random() * questions.length);
	currentQuestion = questions[questionN];
	let question = typeof currentQuestion.q == "string" ? currentQuestion.q : "?";
	let answer =
		typeof currentQuestion.a == "string"
			? currentQuestion.a
			: currentQuestion.a();
	if (typeof currentQuestion.q === "function") {
		const question_parts = currentQuestion.q();
		if (typeof question_parts === "object") {
			question = question_parts.q;
			answer = question_parts.a;
		} else if (typeof question_parts === "string") {
			question = question_parts;
		}
	}
	currentQuestion = { q: question, a: answer };
	console.log(`  > ${currentQuestion.q}`);
	channel.send(question);
}

async function saveStandings() {
	console.log("Saving standings ...");
	const fs = await import("fs");
	fs.writeFileSync("./standings.json", JSON.stringify(standings));
}

client.login(token);

import { TextChannel } from 'discord.js';
import { db } from './db';

function addPoint(channel: TextChannel, name: string, question: Question) {
	let query = db.query('INSERT INTO Points (channelID,userName,category) VALUES ($channelID,$userName,$category)');
	query.run({
		$channelID: channel.id,
		$userName: name,
		$category: question.category,
	});
}

function getStandings(channel: TextChannel) {}

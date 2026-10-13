CREATE TABLE `business_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`year` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`status` enum('draft','in_progress','completed') NOT NULL DEFAULT 'draft',
	`inputData` text,
	`chatHistory` text,
	`generatedContent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_plans_id` PRIMARY KEY(`id`)
);

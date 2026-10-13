CREATE TABLE `evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`period` varchar(20) NOT NULL,
	`periodLabel` varchar(50) NOT NULL,
	`title` varchar(300) NOT NULL,
	`contentActivity` text,
	`contentOutcome` text,
	`contentPerformance` text,
	`contentSelfEval` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluations_id` PRIMARY KEY(`id`)
);

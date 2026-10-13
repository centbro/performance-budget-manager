CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`totalBudget` decimal(15,0) NOT NULL DEFAULT '0',
	`q1Budget` decimal(15,0) NOT NULL DEFAULT '0',
	`q2Budget` decimal(15,0) NOT NULL DEFAULT '0',
	`q3Budget` decimal(15,0) NOT NULL DEFAULT '0',
	`q4Budget` decimal(15,0) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budgetId` int NOT NULL,
	`userId` int NOT NULL,
	`expenseDate` date NOT NULL,
	`amount` decimal(15,0) NOT NULL,
	`category` enum('labor','operation','project') NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`gender` enum('male','female') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`recordDate` date NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `performance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectName` varchar(200) NOT NULL,
	`subProjectName` varchar(200),
	`plannedPeople` int,
	`plannedExtended` int,
	`plannedCount` int,
	`isAdHoc` boolean NOT NULL DEFAULT false,
	`year` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `record_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordId` int NOT NULL,
	`participantId` int NOT NULL,
	CONSTRAINT `record_participants_id` PRIMARY KEY(`id`)
);

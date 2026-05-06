CREATE TABLE `appointment_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`serviceId` int NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`commissionPct` decimal(5,2) NOT NULL,
	`commissionValue` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointment_services_id` PRIMARY KEY(`id`)
);

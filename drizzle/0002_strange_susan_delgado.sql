ALTER TABLE `commission_rules` MODIFY COLUMN `professionalId` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `timeSlot` varchar(5);--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);
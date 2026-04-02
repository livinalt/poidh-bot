import chalk from "chalk";

const ts = () => new Date().toISOString().slice(11, 19);

export const log = {
  info:    (msg) => console.log(chalk.cyan(`[${ts()}] ℹ  ${msg}`)),
  success: (msg) => console.log(chalk.green(`[${ts()}]  ${msg}`)),
  warn:    (msg) => console.log(chalk.yellow(`[${ts()}] ${msg}`)),
  error:   (msg) => console.log(chalk.red(`[${ts()}]  ${msg}`)),
  step:    (msg) => console.log(chalk.bold.white(`\n[${ts()}]  ${msg}`)),
  dim:     (msg) => console.log(chalk.gray(`[${ts()}]    ${msg}`)),
};

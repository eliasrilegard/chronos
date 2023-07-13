use std::sync::Arc;

use serenity::async_trait;
use serenity::builder::CreateInteractionResponseData;
use serenity::http::Http;
use serenity::model::prelude::{Attachment, PartialChannel, Role, PartialMember};
use serenity::model::prelude::command::CommandOptionType;
use serenity::model::prelude::interaction::application_command::{ApplicationCommandInteraction, CommandDataOptionValue, CommandDataOption};
use serenity::model::user::User;

use tracing::error;

use crate::Result;

#[async_trait]
pub trait BetterResponse {
  async fn reply<'a, ReplyFn>(&self, http: &Arc<Http>, reply: ReplyFn) -> Result<()>
    where for<'b> ReplyFn: FnOnce(&'b mut CreateInteractionResponseData<'a>) -> &'b mut CreateInteractionResponseData<'a> + Send;
}

#[async_trait]
impl BetterResponse for ApplicationCommandInteraction {
  async fn reply<'a, ReplyFn>(&self, http: &Arc<Http>, reply: ReplyFn) -> Result<()>
    where for<'b> ReplyFn: FnOnce(&'b mut CreateInteractionResponseData<'a>) -> &'b mut CreateInteractionResponseData<'a> + Send
  {
    if let Err(why) = self.create_interaction_response(http, |response| {
      response.interaction_response_data(|message| reply(message))
    }).await {
      error!("Encountered an error while reponding to chat command:\n{:?}", why);
    }

    Ok(())
  }
}

pub trait InteractionCustomGet {
  fn get_subcommand(&self) -> Option<CommandDataOption>;
  fn get_subcommand_group(&self) -> Option<CommandDataOption>;
  fn get_string(&self, name: &str) -> Option<String>;
  fn get_integer(&self, name: &str) -> Option<i64>;
  fn get_bool(&self, name: &str) -> Option<bool>;
  fn get_user(&self, name: &str) -> Option<(User, Option<PartialMember>)>;
  fn get_channel(&self, name: &str) -> Option<PartialChannel>;
  fn get_role(&self, name: &str) -> Option<Role>;
  fn get_number(&self, name: &str) -> Option<f64>;
  fn get_attachment(&self, name: &str) -> Option<Attachment>;
}

fn get_value<'a>(interaction: &'a ApplicationCommandInteraction, name: &'a str, kind: CommandOptionType) -> Option<&'a CommandDataOptionValue> {
  // Hoist options
  let options = if let Some(option) = interaction.data.options.get(0) {
    match option.kind {
      CommandOptionType::SubCommand => &option.options,
      CommandOptionType::SubCommandGroup => &option.options.get(0).unwrap().options,
      _ => &interaction.data.options
    }
  } else { &interaction.data.options };

  if let Some(found_option) = options.iter().find(|option| option.kind == kind && option.name == name) {
    let value = found_option.resolved.as_ref().expect("No resolved value exists");
    Some(value)
  } else { None }
}

impl InteractionCustomGet for ApplicationCommandInteraction {
  fn get_subcommand(&self) -> Option<CommandDataOption> {
    // Hoist potential subcommand group options
    let options = if let Some(group) = self.data.options.iter().find(|option| option.kind == CommandOptionType::SubCommandGroup) {
      let mut options = self.data.options.clone();
      options.extend(group.options.clone());
      options
    } else { self.data.options.clone() };

    let option = options.iter().find(|option| option.kind == CommandOptionType::SubCommand);
    if let Some(subcommand) = option {
      Some(subcommand.to_owned())
    } else { None }
  }

  fn get_subcommand_group(&self) -> Option<CommandDataOption> {
    let option = self.data.options.iter().find(|option| option.kind == CommandOptionType::SubCommandGroup);
    if let Some(subcommand_group) = option {
      Some(subcommand_group.to_owned())
    } else { None }
  }

  fn get_string(&self, name: &str) -> Option<String> {
    if let Some(CommandDataOptionValue::String(value)) = get_value(&self, name, CommandOptionType::String) {
      Some(value.to_owned())
    } else { None }
  }
  
  fn get_integer(&self, name: &str) -> Option<i64> {  
    if let Some(CommandDataOptionValue::Integer(value)) = get_value(&self, name, CommandOptionType::Integer) {
      Some(value.to_owned())
    } else { None }
  }
  
  fn get_bool(&self, name: &str) -> Option<bool> {
    if let Some(CommandDataOptionValue::Boolean(value)) = get_value(&self, name, CommandOptionType::Boolean) {
      Some(value.to_owned())
    } else { None }
  }
  
  fn get_user(&self, name: &str) -> Option<(User, Option<PartialMember>)> {
    if let Some(CommandDataOptionValue::User(user, partial_member)) = get_value(&self, name, CommandOptionType::User) {
      Some((user.to_owned(), partial_member.to_owned()))
    } else { None }
  }

  fn get_channel(&self, name: &str) -> Option<PartialChannel> {
    if let Some(CommandDataOptionValue::Channel(channel)) = get_value(&self, name, CommandOptionType::Channel) {
      Some(channel.to_owned())
    } else { None }
  }
  
  fn get_role(&self, name: &str) -> Option<Role> {
    if let Some(CommandDataOptionValue::Role(role)) = get_value(&self, name, CommandOptionType::Role) {
      Some(role.to_owned())
    } else { None }
  }
  
  fn get_number(&self, name: &str) -> Option<f64> {
    if let Some(CommandDataOptionValue::Number(value)) = get_value(&self, name, CommandOptionType::Number) {
      Some(value.to_owned())
    } else { None }
  }

  fn get_attachment(&self, name: &str) -> Option<Attachment> {
    if let Some(CommandDataOptionValue::Attachment(attachment)) = get_value(&self, name, CommandOptionType::Attachment) {
      Some(attachment.to_owned())
    } else { None }
  }
}
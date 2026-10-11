extends Node
## Story state: quests, journal, dialogue database. (Full content wired in story bible task.)

signal quest_updated(quest_id: String)
signal journal_added(entry_id: String)

var quests := {}


func quest_state() -> Dictionary:
	return quests


func restore_quests(q: Dictionary) -> void:
	quests = q

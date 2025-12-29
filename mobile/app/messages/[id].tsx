import { useState, useEffect, useRef } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: number;
  other_user_id: number;
  other_user_name: string;
  listing_id?: number;
  listing_title?: string;
  messages: Message[];
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colorList = [
    colors.purple,
    colors.primary,
    colors.success,
    colors.accent,
    colors.error,
    colors.pink,
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorList[Math.abs(hash) % colorList.length];
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { apiClient, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadConversation();
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadConversation, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (conversation?.messages && conversation.messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation?.messages]);

  async function loadConversation() {
    try {
      const data = await apiClient.getConversation(Number(id));
      setConversation(data);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!messageContent.trim() || sending) return;

    setSending(true);
    try {
      await apiClient.sendMessageToConversation(Number(id), messageContent.trim());
      setMessageContent("");
      await loadConversation();
    } catch (error: any) {
      console.error("Failed to send message:", error);
      alert(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header showLogo={false} showBackButton={true} title="Loading..." />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, fontSize: 16, color: colors.textMuted, fontWeight: "500" }}>
            Loading conversation... 💬
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header showLogo={false} showBackButton={true} title="Not Found" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textMain, marginBottom: 8 }}>
            Conversation not found
          </Text>
          <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: "center", marginBottom: 24 }}>
            The conversation you are looking for does not exist.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 16,
            }}
            onPress={() => router.push("/messages")}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
              Back to Messages
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnMessage = (message: Message) => message.sender_id === user?.id;
  const avatarColor = getAvatarColor(conversation.other_user_name);
  const initials = getInitials(conversation.other_user_name);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          backgroundColor: colors.backgroundCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: avatarColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain }}>
              {conversation.other_user_name}
            </Text>
            {conversation.listing_title && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Ionicons name="bag" size={12} color={colors.textMuted} />
                <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                  {conversation.listing_title}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={conversation.messages}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          renderItem={({ item }) => {
            const ownMessage = isOwnMessage(item);
            return (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: ownMessage ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}
              >
                {!ownMessage && (
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: getAvatarColor(item.sender_name),
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                      {getInitials(item.sender_name)}
                    </Text>
                  </View>
                )}
                <View style={{ maxWidth: "75%" }}>
                  {!ownMessage && (
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted, marginBottom: 4, marginLeft: 4 }}>
                      {item.sender_name}
                    </Text>
                  )}
                  <View
                    style={{
                      backgroundColor: ownMessage
                        ? colors.primary
                        : colors.backgroundCard,
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderWidth: ownMessage ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: ownMessage ? "#FFFFFF" : colors.textMain,
                        lineHeight: 20,
                      }}
                    >
                      {item.content}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: ownMessage ? "#FFFFFF80" : colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.textMain, marginTop: 16 }}>
                No messages yet
              </Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: "center" }}>
                Start the conversation! 💬
              </Text>
            </View>
          }
        />

        {/* Message Input */}
        <View
          style={{
            backgroundColor: colors.backgroundCard,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: colors.gray50,
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 15,
              color: colors.textMain,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={messageContent}
            onChangeText={setMessageContent}
            multiline
            textAlignVertical="center"
          />
          <TouchableOpacity
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: messageContent.trim() ? colors.primary : colors.gray300,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleSendMessage}
            disabled={!messageContent.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


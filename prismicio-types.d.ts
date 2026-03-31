import type * as prismic from "@prismicio/client";

type Simplify<T> = { [KeyType in keyof T]: T[KeyType] };


type PickContentRelationshipFieldData<
	TRelationship extends prismic.CustomTypeModelFetchCustomTypeLevel1 | prismic.CustomTypeModelFetchCustomTypeLevel2 | prismic.CustomTypeModelFetchGroupLevel1 | prismic.CustomTypeModelFetchGroupLevel2,
	TData extends Record<string, prismic.AnyRegularField | prismic.GroupField | prismic.NestedGroupField | prismic.SliceZone>,
	TLang extends string
> = |
	// Content relationship fields
	{
		[TSubRelationship in Extract<
			TRelationship["fields"][number], prismic.CustomTypeModelFetchContentRelationshipLevel1
		> as TSubRelationship["id"]]:
			ContentRelationshipFieldWithData<TSubRelationship["customtypes"], TLang>;
	} &
	// Group
	{
		[TGroup in Extract<
			TRelationship["fields"][number], prismic.CustomTypeModelFetchGroupLevel1 | prismic.CustomTypeModelFetchGroupLevel2
		> as TGroup["id"]]:
			TData[TGroup["id"]] extends prismic.GroupField<infer TGroupData>
				? prismic.GroupField<PickContentRelationshipFieldData<TGroup, TGroupData, TLang>>
				: never
	} &
	// Other fields
	{
		[TFieldKey in Extract<TRelationship["fields"][number], string>]:
			TFieldKey extends keyof TData ? TData[TFieldKey] : never;
	};

type ContentRelationshipFieldWithData<
	TCustomType extends readonly (prismic.CustomTypeModelFetchCustomTypeLevel1 | string)[] | readonly (prismic.CustomTypeModelFetchCustomTypeLevel2 | string)[],
	TLang extends string = string
> = {
	[ID in Exclude<TCustomType[number], string>["id"]]:
		prismic.ContentRelationshipField<
			ID,
			TLang,
			PickContentRelationshipFieldData<
				Extract<TCustomType[number], { id: ID }>,
				Extract<prismic.Content.AllDocumentTypes, { type: ID }>["data"],
				TLang
			>
		>
}[Exclude<TCustomType[number], string>["id"]];

/**
 * Content for cta documents
 */
interface CtaDocumentData {
	/**
	 * label field in *cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: cta.label
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * link field in *cta*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: cta.link
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">;
	
	/**
	 * icon field in *cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: cta.icon
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
}

/**
 * cta document from Prismic
 *
 * - **API ID**: `cta`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type CtaDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<CtaDocumentData>, "cta", Lang>;

type HomePageDocumentDataSlicesSlice = HeroSectionSlice | UpcomingEventSlice | FeaturedFightersSlice | VideoHighlightsSlice | LatestNewsSlice | NewsletterSlice | SponsorLogosSlice

/**
 * Content for Home page documents
 */
interface HomePageDocumentData {
	/**
	 * Slice Zone field in *Home page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: home_page.slices[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	slices: prismic.SliceZone<HomePageDocumentDataSlicesSlice>;/**
	 * Meta Title field in *Home page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A title of the page used for social media and search engines
	 * - **API ID Path**: home_page.meta_title
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;
	
	/**
	 * Meta Description field in *Home page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A brief summary of the page
	 * - **API ID Path**: home_page.meta_description
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;
	
	/**
	 * Meta Image field in *Home page*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: home_page.meta_image
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	meta_image: prismic.ImageField<never>;
}

/**
 * Home page document from Prismic
 *
 * - **API ID**: `home_page`
 * - **Repeatable**: `false`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type HomePageDocument<Lang extends string = string> = prismic.PrismicDocumentWithoutUID<Simplify<HomePageDocumentData>, "home_page", Lang>;

type PageDocumentDataSlicesSlice = HeroSectionSlice | UpcomingEventSlice | FeaturedFightersSlice | LatestNewsSlice | VideoHighlightsSlice | NewsletterSlice | SponsorLogosSlice | EventArchiveTableSlice | FeaturedEventHeroSlice | UpcomingEventsGridSlice | VenueInformationSlice

/**
 * Content for page documents
 */
interface PageDocumentData {
	/**
	 * Slice Zone field in *page*
	 *
	 * - **Field Type**: Slice Zone
	 * - **Placeholder**: *None*
	 * - **API ID Path**: page.slices[]
	 * - **Tab**: Main
	 * - **Documentation**: https://prismic.io/docs/slices
	 */
	slices: prismic.SliceZone<PageDocumentDataSlicesSlice>;/**
	 * Meta Title field in *page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A title of the page used for social media and search engines
	 * - **API ID Path**: page.meta_title
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_title: prismic.KeyTextField;
	
	/**
	 * Meta Description field in *page*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: A brief summary of the page
	 * - **API ID Path**: page.meta_description
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	meta_description: prismic.KeyTextField;
	
	/**
	 * Meta Image field in *page*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: page.meta_image
	 * - **Tab**: SEO & Metadata
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	meta_image: prismic.ImageField<never>;
}

/**
 * page document from Prismic
 *
 * - **API ID**: `page`
 * - **Repeatable**: `true`
 * - **Documentation**: https://prismic.io/docs/content-modeling
 *
 * @typeParam Lang - Language API ID of the document.
 */
export type PageDocument<Lang extends string = string> = prismic.PrismicDocumentWithUID<Simplify<PageDocumentData>, "page", Lang>;

export type AllDocumentTypes = CtaDocument | HomePageDocument | PageDocument;

/**
 * Item in *EventArchiveTable → Default → Primary → table headers*
 */
export interface EventArchiveTableSliceDefaultPrimaryTableHeadersItem {
	/**
	 * text field in *EventArchiveTable → Default → Primary → table headers*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.table_headers[].text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
}

/**
 * Item in *EventArchiveTable → Default → Primary → events*
 */
export interface EventArchiveTableSliceDefaultPrimaryEventsItem {
	/**
	 * name field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * date field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Date
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].date
	 * - **Documentation**: https://prismic.io/docs/fields/date
	 */
	date: prismic.DateField;
	
	/**
	 * result field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].result
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	result: prismic.KeyTextField;
	
	/**
	 * replay youtube link field in *EventArchiveTable → Default → Primary → events*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[].replay_youtube_link
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	replay_youtube_link: prismic.EmbedField
}

/**
 * Primary content in *EventArchiveTable → Default → Primary*
 */
export interface EventArchiveTableSliceDefaultPrimary {
	/**
	 * title field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * table headers field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.table_headers[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	table_headers: prismic.GroupField<Simplify<EventArchiveTableSliceDefaultPrimaryTableHeadersItem>>;
	
	/**
	 * events field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.events[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	events: prismic.GroupField<Simplify<EventArchiveTableSliceDefaultPrimaryEventsItem>>;
	
	/**
	 * load more button label field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.load_more_button_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	load_more_button_label: prismic.KeyTextField;
	
	/**
	 * load more button link field in *EventArchiveTable → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: event_archive_table.default.primary.load_more_button_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	load_more_button_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Default variation for EventArchiveTable Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type EventArchiveTableSliceDefault = prismic.SharedSliceVariation<"default", Simplify<EventArchiveTableSliceDefaultPrimary>, never>;

/**
 * Slice variation for *EventArchiveTable*
 */
type EventArchiveTableSliceVariation = EventArchiveTableSliceDefault

/**
 * EventArchiveTable Shared Slice
 *
 * - **API ID**: `event_archive_table`
 * - **Description**: EventArchiveTable
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type EventArchiveTableSlice = prismic.SharedSlice<"event_archive_table", EventArchiveTableSliceVariation>;

/**
 * Item in *FeaturedEventHero → Default → Primary → cta*
 */
export interface FeaturedEventHeroSliceDefaultPrimaryCtaItem {
	/**
	 * label field in *FeaturedEventHero → Default → Primary → cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.cta[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * link field in *FeaturedEventHero → Default → Primary → cta*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.cta[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">;
}

/**
 * Primary content in *FeaturedEventHero → Default → Primary*
 */
export interface FeaturedEventHeroSliceDefaultPrimary {
	/**
	 * badge field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.badge
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	badge: prismic.KeyTextField;
	
	/**
	 * title field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * subtitle field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * date field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Timestamp
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.date
	 * - **Documentation**: https://prismic.io/docs/fields/timestamp
	 */
	date: prismic.TimestampField;
	
	/**
	 * image field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * cta field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.cta[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	cta: prismic.GroupField<Simplify<FeaturedEventHeroSliceDefaultPrimaryCtaItem>>;
	
	/**
	 * location field in *FeaturedEventHero → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_event_hero.default.primary.location
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	location: prismic.KeyTextField;
}

/**
 * Default variation for FeaturedEventHero Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedEventHeroSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FeaturedEventHeroSliceDefaultPrimary>, never>;

/**
 * Slice variation for *FeaturedEventHero*
 */
type FeaturedEventHeroSliceVariation = FeaturedEventHeroSliceDefault

/**
 * FeaturedEventHero Shared Slice
 *
 * - **API ID**: `featured_event_hero`
 * - **Description**: FeaturedEventHero
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedEventHeroSlice = prismic.SharedSlice<"featured_event_hero", FeaturedEventHeroSliceVariation>;

/**
 * Item in *FeaturedFighters → Default → Primary → Fighters*
 */
export interface FeaturedFightersSliceDefaultPrimaryFightersItem {
	/**
	 * name field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	name: prismic.KeyTextField;
	
	/**
	 * nickname field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].nickname
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	nickname: prismic.KeyTextField;
	
	/**
	 * record field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].record
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	record: prismic.KeyTextField;
	
	/**
	 * nationality field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].nationality
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	nationality: prismic.KeyTextField;
	
	/**
	 * height field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].height
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	height: prismic.KeyTextField;
	
	/**
	 * age field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].age
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	age: prismic.KeyTextField;
	
	/**
	 * fighter image field in *FeaturedFighters → Default → Primary → Fighters*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[].fighter_image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	fighter_image: prismic.ImageField<never>;
}

/**
 * Primary content in *FeaturedFighters → Default → Primary*
 */
export interface FeaturedFightersSliceDefaultPrimary {
	/**
	 * Title field in *FeaturedFighters → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Subtitle field in *FeaturedFighters → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * Fighters field in *FeaturedFighters → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: featured_fighters.default.primary.fighters[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	fighters: prismic.GroupField<Simplify<FeaturedFightersSliceDefaultPrimaryFightersItem>>;
}

/**
 * Default variation for FeaturedFighters Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedFightersSliceDefault = prismic.SharedSliceVariation<"default", Simplify<FeaturedFightersSliceDefaultPrimary>, never>;

/**
 * Slice variation for *FeaturedFighters*
 */
type FeaturedFightersSliceVariation = FeaturedFightersSliceDefault

/**
 * FeaturedFighters Shared Slice
 *
 * - **API ID**: `featured_fighters`
 * - **Description**: FeaturedFighters
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type FeaturedFightersSlice = prismic.SharedSlice<"featured_fighters", FeaturedFightersSliceVariation>;

/**
 * Item in *HeroSection → Default → Primary → cta*
 */
export interface HeroSectionSliceDefaultPrimaryCtaItem {
	/**
	 * label field in *HeroSection → Default → Primary → cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[].label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	label: prismic.KeyTextField;
	
	/**
	 * link field in *HeroSection → Default → Primary → cta*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, "Primary" | "Secondary">;
	
	/**
	 * icon field in *HeroSection → Default → Primary → cta*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[].icon
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
}

/**
 * Primary content in *HeroSection → Default → Primary*
 */
export interface HeroSectionSliceDefaultPrimary {
	/**
	 * Background Image field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.background_image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	background_image: prismic.ImageField<never>;
	
	/**
	 * Badge Text field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.badge_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	badge_text: prismic.KeyTextField;
	
	/**
	 * Headline 1 field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.headline_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_1: prismic.KeyTextField;
	
	/**
	 * Headline 2 field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.headline_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_2: prismic.KeyTextField;
	
	/**
	 * Headline 3 field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.headline_3
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_3: prismic.KeyTextField;
	
	/**
	 * description field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Rich Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/rich-text
	 */
	description: prismic.RichTextField;
	
	/**
	 * Event time field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Timestamp
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.event_time
	 * - **Documentation**: https://prismic.io/docs/fields/timestamp
	 */
	event_time: prismic.TimestampField;
	
	/**
	 * Event Location field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.event_location
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	event_location: prismic.KeyTextField;
	
	/**
	 * cta field in *HeroSection → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: hero_section.default.primary.cta[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	cta: prismic.GroupField<Simplify<HeroSectionSliceDefaultPrimaryCtaItem>>;
}

/**
 * Default variation for HeroSection Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type HeroSectionSliceDefault = prismic.SharedSliceVariation<"default", Simplify<HeroSectionSliceDefaultPrimary>, never>;

/**
 * Slice variation for *HeroSection*
 */
type HeroSectionSliceVariation = HeroSectionSliceDefault

/**
 * HeroSection Shared Slice
 *
 * - **API ID**: `hero_section`
 * - **Description**: HeroSection
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type HeroSectionSlice = prismic.SharedSlice<"hero_section", HeroSectionSliceVariation>;

/**
 * Item in *LatestNews → Default → Primary → articles*
 */
export interface LatestNewsSliceDefaultPrimaryArticlesItem {
	/**
	 * title field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * date field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Date
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].date
	 * - **Documentation**: https://prismic.io/docs/fields/date
	 */
	date: prismic.DateField;
	
	/**
	 * excerpt field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].excerpt
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	excerpt: prismic.KeyTextField;
	
	/**
	 * image field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * article link field in *LatestNews → Default → Primary → articles*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[].article_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	article_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *LatestNews → Default → Primary*
 */
export interface LatestNewsSliceDefaultPrimary {
	/**
	 * title field in *LatestNews → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * show all link field in *LatestNews → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.show_all_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	show_all_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * articles field in *LatestNews → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: latest_news.default.primary.articles[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	articles: prismic.GroupField<Simplify<LatestNewsSliceDefaultPrimaryArticlesItem>>;
}

/**
 * Default variation for LatestNews Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type LatestNewsSliceDefault = prismic.SharedSliceVariation<"default", Simplify<LatestNewsSliceDefaultPrimary>, never>;

/**
 * Slice variation for *LatestNews*
 */
type LatestNewsSliceVariation = LatestNewsSliceDefault

/**
 * LatestNews Shared Slice
 *
 * - **API ID**: `latest_news`
 * - **Description**: LatestNews
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type LatestNewsSlice = prismic.SharedSlice<"latest_news", LatestNewsSliceVariation>;

/**
 * Primary content in *Newsletter → Default → Primary*
 */
export interface NewsletterSliceDefaultPrimary {
	/**
	 * headline 1 field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.headline_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_1: prismic.KeyTextField;
	
	/**
	 * headline 2 field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.headline_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	headline_2: prismic.KeyTextField;
	
	/**
	 * description field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
	
	/**
	 * email placeholder field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.email_placeholder
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	email_placeholder: prismic.KeyTextField;
	
	/**
	 * submit label field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.submit_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	submit_label: prismic.KeyTextField;
	
	/**
	 * success message field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.success_message
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	success_message: prismic.KeyTextField;
	
	/**
	 * error message field in *Newsletter → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: newsletter.default.primary.error_message
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	error_message: prismic.KeyTextField;
}

/**
 * Default variation for Newsletter Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type NewsletterSliceDefault = prismic.SharedSliceVariation<"default", Simplify<NewsletterSliceDefaultPrimary>, never>;

/**
 * Slice variation for *Newsletter*
 */
type NewsletterSliceVariation = NewsletterSliceDefault

/**
 * Newsletter Shared Slice
 *
 * - **API ID**: `newsletter`
 * - **Description**: Newsletter
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type NewsletterSlice = prismic.SharedSlice<"newsletter", NewsletterSliceVariation>;

/**
 * Item in *SponsorLogos → Default → Primary → sponsors*
 */
export interface SponsorLogosSliceDefaultPrimarySponsorsItem {
	/**
	 * logo field in *SponsorLogos → Default → Primary → sponsors*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.sponsors[].logo
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	logo: prismic.ImageField<never>;
	
	/**
	 * link field in *SponsorLogos → Default → Primary → sponsors*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.sponsors[].link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *SponsorLogos → Default → Primary*
 */
export interface SponsorLogosSliceDefaultPrimary {
	/**
	 * title field in *SponsorLogos → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * sponsors field in *SponsorLogos → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: sponsor_logos.default.primary.sponsors[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	sponsors: prismic.GroupField<Simplify<SponsorLogosSliceDefaultPrimarySponsorsItem>>;
}

/**
 * Default variation for SponsorLogos Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type SponsorLogosSliceDefault = prismic.SharedSliceVariation<"default", Simplify<SponsorLogosSliceDefaultPrimary>, never>;

/**
 * Slice variation for *SponsorLogos*
 */
type SponsorLogosSliceVariation = SponsorLogosSliceDefault

/**
 * SponsorLogos Shared Slice
 *
 * - **API ID**: `sponsor_logos`
 * - **Description**: SponsorLogos
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type SponsorLogosSlice = prismic.SharedSlice<"sponsor_logos", SponsorLogosSliceVariation>;

/**
 * Primary content in *UpcomingEvent → Default → Primary*
 */
export interface UpcomingEventSliceDefaultPrimary {
	/**
	 * title field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * Event Date field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Timestamp
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.event_date
	 * - **Documentation**: https://prismic.io/docs/fields/timestamp
	 */
	event_date: prismic.TimestampField;
	
	/**
	 * Event Venue field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.event_venue
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	event_venue: prismic.KeyTextField;
	
	/**
	 * Event Poster field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.event_poster
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	event_poster: prismic.ImageField<never>;
	
	/**
	 * Main Headline field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.main_headline
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	main_headline: prismic.KeyTextField;
	
	/**
	 * Subtitle field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * Background Watermark field in *UpcomingEvent → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_event.default.primary.background_watermark
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	background_watermark: prismic.KeyTextField;
}

/**
 * Default variation for UpcomingEvent Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventSliceDefault = prismic.SharedSliceVariation<"default", Simplify<UpcomingEventSliceDefaultPrimary>, never>;

/**
 * Slice variation for *UpcomingEvent*
 */
type UpcomingEventSliceVariation = UpcomingEventSliceDefault

/**
 * UpcomingEvent Shared Slice
 *
 * - **API ID**: `upcoming_event`
 * - **Description**: UpcomingEvent
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventSlice = prismic.SharedSlice<"upcoming_event", UpcomingEventSliceVariation>;

/**
 * Item in *UpcomingEventsGrid → Default → Primary → events*
 */
export interface UpcomingEventsGridSliceDefaultPrimaryEventsItem {
	/**
	 * badge field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].badge
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	badge: prismic.KeyTextField;
	
	/**
	 * title field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * date field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Date
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].date
	 * - **Documentation**: https://prismic.io/docs/fields/date
	 */
	date: prismic.DateField;
	
	/**
	 * venue field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].venue
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	venue: prismic.KeyTextField;
	
	/**
	 * image field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].image
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	image: prismic.ImageField<never>;
	
	/**
	 * tags comma separated field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].tags_comma_separated
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	tags_comma_separated: prismic.KeyTextField;
	
	/**
	 * tickets button text field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].tickets_button_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	tickets_button_text: prismic.KeyTextField;
	
	/**
	 * tickets button link field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].tickets_button_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	tickets_button_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * stream button text field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].stream_button_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	stream_button_text: prismic.KeyTextField;
	
	/**
	 * stream button link field in *UpcomingEventsGrid → Default → Primary → events*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[].stream_button_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	stream_button_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
}

/**
 * Primary content in *UpcomingEventsGrid → Default → Primary*
 */
export interface UpcomingEventsGridSliceDefaultPrimary {
	/**
	 * title field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * subtitle field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.subtitle
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	subtitle: prismic.KeyTextField;
	
	/**
	 * decorative text field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.decorative_text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	decorative_text: prismic.KeyTextField;
	
	/**
	 * events field in *UpcomingEventsGrid → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: upcoming_events_grid.default.primary.events[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	events: prismic.GroupField<Simplify<UpcomingEventsGridSliceDefaultPrimaryEventsItem>>;
}

/**
 * Default variation for UpcomingEventsGrid Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventsGridSliceDefault = prismic.SharedSliceVariation<"default", Simplify<UpcomingEventsGridSliceDefaultPrimary>, never>;

/**
 * Slice variation for *UpcomingEventsGrid*
 */
type UpcomingEventsGridSliceVariation = UpcomingEventsGridSliceDefault

/**
 * UpcomingEventsGrid Shared Slice
 *
 * - **API ID**: `upcoming_events_grid`
 * - **Description**: UpcomingEventsGrid
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type UpcomingEventsGridSlice = prismic.SharedSlice<"upcoming_events_grid", UpcomingEventsGridSliceVariation>;

/**
 * Item in *VenueInformation → Default → Primary → transport info*
 */
export interface VenueInformationSliceDefaultPrimaryTransportInfoItem {
	/**
	 * icon field in *VenueInformation → Default → Primary → transport info*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.transport_info[].icon
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	icon: prismic.KeyTextField;
	
	/**
	 * text field in *VenueInformation → Default → Primary → transport info*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.transport_info[].text
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	text: prismic.KeyTextField;
}

/**
 * Primary content in *VenueInformation → Default → Primary*
 */
export interface VenueInformationSliceDefaultPrimary {
	/**
	 * title line 1 field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.title_line_1
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_line_1: prismic.KeyTextField;
	
	/**
	 * title line 2 field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.title_line_2
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title_line_2: prismic.KeyTextField;
	
	/**
	 * venue label field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.venue_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	venue_label: prismic.KeyTextField;
	
	/**
	 * venue name field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.venue_name
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	venue_name: prismic.KeyTextField;
	
	/**
	 * transport info field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.transport_info[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	transport_info: prismic.GroupField<Simplify<VenueInformationSliceDefaultPrimaryTransportInfoItem>>;
	
	/**
	 * directions button label field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.directions_button_label
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	directions_button_label: prismic.KeyTextField;
	
	/**
	 * directions buttons link field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Link
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.directions_buttons_link
	 * - **Documentation**: https://prismic.io/docs/fields/link
	 */
	directions_buttons_link: prismic.LinkField<string, string, unknown, prismic.FieldState, never>;
	
	/**
	 * address field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.address
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	address: prismic.KeyTextField;
	
	/**
	 * google maps embed field in *VenueInformation → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: venue_information.default.primary.google_maps_embed
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	google_maps_embed: prismic.KeyTextField;
}

/**
 * Default variation for VenueInformation Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VenueInformationSliceDefault = prismic.SharedSliceVariation<"default", Simplify<VenueInformationSliceDefaultPrimary>, never>;

/**
 * Slice variation for *VenueInformation*
 */
type VenueInformationSliceVariation = VenueInformationSliceDefault

/**
 * VenueInformation Shared Slice
 *
 * - **API ID**: `venue_information`
 * - **Description**: VenueInformation
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VenueInformationSlice = prismic.SharedSlice<"venue_information", VenueInformationSliceVariation>;

/**
 * Item in *VideoHighlights → Default → Primary → highlights*
 */
export interface VideoHighlightsSliceDefaultPrimaryVideosItem {
	/**
	 * title field in *VideoHighlights → Default → Primary → highlights*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[].title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * thumbnail field in *VideoHighlights → Default → Primary → highlights*
	 *
	 * - **Field Type**: Image
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[].thumbnail
	 * - **Documentation**: https://prismic.io/docs/fields/image
	 */
	thumbnail: prismic.ImageField<never>;
	
	/**
	 * youtube url field in *VideoHighlights → Default → Primary → highlights*
	 *
	 * - **Field Type**: Embed
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[].youtube_url
	 * - **Documentation**: https://prismic.io/docs/fields/embed
	 */
	youtube_url: prismic.EmbedField
}

/**
 * Primary content in *VideoHighlights → Default → Primary*
 */
export interface VideoHighlightsSliceDefaultPrimary {
	/**
	 * title field in *VideoHighlights → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.title
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	title: prismic.KeyTextField;
	
	/**
	 * description field in *VideoHighlights → Default → Primary*
	 *
	 * - **Field Type**: Text
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.description
	 * - **Documentation**: https://prismic.io/docs/fields/text
	 */
	description: prismic.KeyTextField;
	
	/**
	 * highlights field in *VideoHighlights → Default → Primary*
	 *
	 * - **Field Type**: Group
	 * - **Placeholder**: *None*
	 * - **API ID Path**: video_highlights.default.primary.videos[]
	 * - **Documentation**: https://prismic.io/docs/fields/repeatable-group
	 */
	videos: prismic.GroupField<Simplify<VideoHighlightsSliceDefaultPrimaryVideosItem>>;
}

/**
 * Default variation for VideoHighlights Slice
 *
 * - **API ID**: `default`
 * - **Description**: Default
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VideoHighlightsSliceDefault = prismic.SharedSliceVariation<"default", Simplify<VideoHighlightsSliceDefaultPrimary>, never>;

/**
 * Slice variation for *VideoHighlights*
 */
type VideoHighlightsSliceVariation = VideoHighlightsSliceDefault

/**
 * VideoHighlights Shared Slice
 *
 * - **API ID**: `video_highlights`
 * - **Description**: VideoHighlights
 * - **Documentation**: https://prismic.io/docs/slices
 */
export type VideoHighlightsSlice = prismic.SharedSlice<"video_highlights", VideoHighlightsSliceVariation>;

declare module "@prismicio/client" {
	interface CreateClient {
		(repositoryNameOrEndpoint: string, options?: prismic.ClientConfig): prismic.Client<AllDocumentTypes>;
	}
	
	interface CreateWriteClient {
		(repositoryNameOrEndpoint: string, options: prismic.WriteClientConfig): prismic.WriteClient<AllDocumentTypes>;
	}
	
	interface CreateMigration {
		(): prismic.Migration<AllDocumentTypes>;
	}
	
	namespace Content {
		export type {
			CtaDocument,
			CtaDocumentData,
			HomePageDocument,
			HomePageDocumentData,
			HomePageDocumentDataSlicesSlice,
			PageDocument,
			PageDocumentData,
			PageDocumentDataSlicesSlice,
			AllDocumentTypes,
			EventArchiveTableSlice,
			EventArchiveTableSliceDefaultPrimaryTableHeadersItem,
			EventArchiveTableSliceDefaultPrimaryEventsItem,
			EventArchiveTableSliceDefaultPrimary,
			EventArchiveTableSliceVariation,
			EventArchiveTableSliceDefault,
			FeaturedEventHeroSlice,
			FeaturedEventHeroSliceDefaultPrimaryCtaItem,
			FeaturedEventHeroSliceDefaultPrimary,
			FeaturedEventHeroSliceVariation,
			FeaturedEventHeroSliceDefault,
			FeaturedFightersSlice,
			FeaturedFightersSliceDefaultPrimaryFightersItem,
			FeaturedFightersSliceDefaultPrimary,
			FeaturedFightersSliceVariation,
			FeaturedFightersSliceDefault,
			HeroSectionSlice,
			HeroSectionSliceDefaultPrimaryCtaItem,
			HeroSectionSliceDefaultPrimary,
			HeroSectionSliceVariation,
			HeroSectionSliceDefault,
			LatestNewsSlice,
			LatestNewsSliceDefaultPrimaryArticlesItem,
			LatestNewsSliceDefaultPrimary,
			LatestNewsSliceVariation,
			LatestNewsSliceDefault,
			NewsletterSlice,
			NewsletterSliceDefaultPrimary,
			NewsletterSliceVariation,
			NewsletterSliceDefault,
			SponsorLogosSlice,
			SponsorLogosSliceDefaultPrimarySponsorsItem,
			SponsorLogosSliceDefaultPrimary,
			SponsorLogosSliceVariation,
			SponsorLogosSliceDefault,
			UpcomingEventSlice,
			UpcomingEventSliceDefaultPrimary,
			UpcomingEventSliceVariation,
			UpcomingEventSliceDefault,
			UpcomingEventsGridSlice,
			UpcomingEventsGridSliceDefaultPrimaryEventsItem,
			UpcomingEventsGridSliceDefaultPrimary,
			UpcomingEventsGridSliceVariation,
			UpcomingEventsGridSliceDefault,
			VenueInformationSlice,
			VenueInformationSliceDefaultPrimaryTransportInfoItem,
			VenueInformationSliceDefaultPrimary,
			VenueInformationSliceVariation,
			VenueInformationSliceDefault,
			VideoHighlightsSlice,
			VideoHighlightsSliceDefaultPrimaryVideosItem,
			VideoHighlightsSliceDefaultPrimary,
			VideoHighlightsSliceVariation,
			VideoHighlightsSliceDefault
		}
	}
}